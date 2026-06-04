"""PDF -> raw text (SPEC.md §5.2).

Uses PyMuPDF for native text. Falls back to rapidocr-onnxruntime for
scanned pages with no text layer (most RGPV papers from 2022+).
"""

from __future__ import annotations

import logging
from pathlib import Path

import fitz  # PyMuPDF

MIN_TEXT_CHARS = 50
OCR_DPI = 200

log = logging.getLogger("extractor")

_ocr_engine = None


def _get_ocr():
    global _ocr_engine
    if _ocr_engine is None:
        from rapidocr_onnxruntime import RapidOCR

        _ocr_engine = RapidOCR()
    return _ocr_engine


def _extract_page_text(page: "fitz.Page") -> str:
    """Layout-aware extraction. Sorts blocks by column (x-bucket) then y."""
    blocks = page.get_text("blocks")  # list[(x0,y0,x1,y1,text,block_no,block_type)]
    if not blocks:
        return ""
    width = page.rect.width or 1
    mid = width / 2
    text_blocks = [b for b in blocks if len(b) >= 5 and isinstance(b[4], str) and b[4].strip()]
    text_blocks.sort(key=lambda b: (0 if b[0] < mid else 1, b[1]))
    return "\n".join(b[4].rstrip() for b in text_blocks)


def _ocr_page(page: "fitz.Page") -> str:
    """Render page to PNG, run rapidocr, join recognized lines."""
    try:
        ocr = _get_ocr()
    except ImportError:
        log.warning("rapidocr-onnxruntime not installed; OCR fallback unavailable")
        return ""
    pix = page.get_pixmap(dpi=OCR_DPI)
    img_bytes = pix.tobytes("png")
    result, _ = ocr(img_bytes)
    if not result:
        return ""
    return "\n".join(line[1] for line in result if len(line) >= 2 and line[1])


def extract_text(pdf_path: Path | str) -> str:
    """Extract full text from a PDF. Raises FileNotFoundError if missing."""
    path = Path(pdf_path)
    if not path.exists():
        raise FileNotFoundError(path)

    pages_out: list[str] = []
    with fitz.open(path) as doc:
        for i, page in enumerate(doc, start=1):
            text = _extract_page_text(page)
            if len(text.strip()) < MIN_TEXT_CHARS:
                log.info("OCR fallback on %s page %d (native=%d chars)", path.name, i, len(text.strip()))
                ocr_text = _ocr_page(page)
                if len(ocr_text.strip()) >= MIN_TEXT_CHARS:
                    text = ocr_text
                else:
                    log.warning("SKIP %s page %d — text+OCR both <%d chars", path.name, i, MIN_TEXT_CHARS)
                    continue
            pages_out.append(text)
    return "\n\n".join(pages_out)
