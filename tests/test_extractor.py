"""Tests for src/extractor.py (SPEC.md §5.2)."""

from __future__ import annotations

import io
from pathlib import Path

import fitz
import pytest

from src.extractor import extract_text


DATA_DIR = Path("data/raw/CS-502")


def _first_text_pdf() -> Path | None:
    if not DATA_DIR.exists():
        return None
    for p in sorted(DATA_DIR.glob("*.pdf")):
        return p
    return None


def test_missing_file_raises():
    with pytest.raises(FileNotFoundError):
        extract_text("does/not/exist.pdf")


def test_text_based_pdf_returns_non_empty():
    sample = _first_text_pdf()
    if sample is None:
        pytest.skip("No CS-502 PDF on disk yet (scraper still running)")
    text = extract_text(sample)
    assert isinstance(text, str)
    assert len(text) > 500, f"extracted text too short ({len(text)} chars)"


def test_ocr_fallback_on_scan(tmp_path: Path):
    """Synth a scan PDF (no text layer) and verify OCR fires + returns text."""
    pytest.importorskip("rapidocr_onnxruntime")

    text_pdf = tmp_path / "src.pdf"
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 100), "Unit I Database Management Systems", fontsize=28)
    page.insert_text((72, 180), "Q1 Define BCNF and explain with example.", fontsize=22)
    page.insert_text((72, 260), "Q2 What is normalization in DBMS theory?", fontsize=22)
    page.insert_text((72, 340), "Q3 Explain transaction isolation levels.", fontsize=22)
    doc.save(text_pdf)
    doc.close()

    scan_pdf = tmp_path / "scan.pdf"
    doc = fitz.open(text_pdf)
    scan = fitz.open()
    for p in doc:
        pix = p.get_pixmap(dpi=200)
        new = scan.new_page(width=p.rect.width, height=p.rect.height)
        new.insert_image(new.rect, stream=pix.tobytes("png"))
    scan.save(scan_pdf)
    scan.close()
    doc.close()

    out = extract_text(scan_pdf)
    assert out.strip(), "OCR fallback returned empty"
    assert "bcnf" in out.lower() or "unit" in out.lower()
