"""Tests for src/parser.py (SPEC.md §5.3)."""

from __future__ import annotations

from pathlib import Path

import pytest

from src.parser import (
    Question,
    _clean_text,
    _english_ratio,
    _infer_marks_from_header,
    _looks_hindi,
    _unit_for,
    parse_paper,
)


SAMPLE_WITH_BARE_MARKS = """
[1]
Total No. of Questions : 8
B.Tech., V Semester
Examination, June 2020
Database Management Systems
Maximum Marks : 70
Note: i) Attempt any five questions.

1. a)
What is Data independence? Why is it essential?
7
{H$?ht nm?M ??Zm| H$mo hb H$s{OE&
b)
Discuss in detail about Primary file organization.
7
?mW{?H$ ?$mBb ?~?YZ H$s {d?Vma go ??m??m H$s{OE&

2. a)
Explain about various constraints used in E-R model.
7
B.Ama.?m?S>b Ho$ {d{^? H$??Q?>o?Q> H$s ??m??m H$s{OE&
b)
Why the concurrency control is needed? Explain it.
7

3. a)
Explain internal hashing techniques.
7
b)
Differentiate Multivalued dependency and Join dependency.
7

4. a)
Find the attribute closures of given FDs in relation R.
7
b)
What do you mean by Schedule?
7

5. a)
Differentiate conflict and view serializability with example.
7
b)
What is Normalization? Why it is required.
7
PTO
"""


SAMPLE_HEADER_INFERS_MARKS = """
[1]
B.Tech., V Semester
Examination, December 2024
Compiler Design
Maximum Marks : 70
Note: Attempt any five questions.

1. a) Define lexical analyzer with example.
b) Explain phases of a compiler.

2. a) Differentiate top-down and bottom-up parsing.
b) Describe LR parser table construction.

3. a) Explain SLR parser working with example.
b) What is operator precedence parsing?
"""


# ---------- Unit tests on helpers ----------

def test_unit_mapping_caps_at_5():
    assert _unit_for(1) == 1
    assert _unit_for(2) == 1
    assert _unit_for(3) == 2
    assert _unit_for(9) == 5
    assert _unit_for(10) == 5


def test_english_ratio_distinguishes_hindi():
    assert _english_ratio("Hello world") > 0.9
    assert _looks_hindi("{H$?ht nm?M ??Zm| H$mo hb H$s{OE&")


def test_clean_text_strips_garble():
    raw = "Define BCNF H$ S>oQ>m and explain"
    cleaned = _clean_text(raw)
    assert "BCNF" in cleaned
    assert "Define" in cleaned
    assert "H$" not in cleaned
    assert "S>oQ>m" not in cleaned


def test_infer_marks_from_header():
    assert _infer_marks_from_header("Maximum Marks : 70 Attempt any five questions") == 14
    assert _infer_marks_from_header("Maximum Marks : 70 Attempt any 5 questions") == 14
    assert _infer_marks_from_header("Just some text") is None


# ---------- End-to-end parse ----------

def test_parses_bare_marks_paper_to_10_questions():
    qs = parse_paper(SAMPLE_WITH_BARE_MARKS, {"label": "sample1"})
    assert len(qs) == 10, f"expected 10, got {len(qs)}"
    for q in qs:
        assert isinstance(q, Question)
        assert q.marks == 7
        assert 1 <= q.unit_number <= 5
        assert q.question_text
    # spot checks
    assert qs[0].question_number == "Q1(a)"
    assert qs[1].question_number == "Q1(b)"
    assert qs[0].unit_number == 1
    # 5 main questions → max unit ((5-1)//2)+1 = 3
    assert qs[8].unit_number == 3


def test_parses_header_inferred_marks():
    qs = parse_paper(SAMPLE_HEADER_INFERS_MARKS, {"label": "sample2"})
    assert len(qs) == 6
    for q in qs:
        assert q.marks == 14, f"expected inferred 14, got {q.marks}"


def test_parser_does_not_crash_on_garbage():
    junk = "\n\n[1]\n???? H$ ??? S>oQ>m\nPTO\nhttps://x.com\n"
    qs = parse_paper(junk, {"label": "junk"})
    assert qs == []


# ---------- Real-paper smoke test ----------

def test_real_cs502_paper_extracts_at_least_4_questions():
    """Run parser on first available CS-502 PDF; require >=80% of 10 questions."""
    pdfs = sorted(Path("data/raw/CS-502").glob("*.pdf"))
    if not pdfs:
        pytest.skip("No CS-502 PDFs available yet")
    from src.parser import parse_file

    qs = parse_file(pdfs[0], {"label": pdfs[0].name})
    assert len(qs) >= 8, f"only {len(qs)} questions parsed from {pdfs[0].name}"
    # at least some marks present
    assert any(q.marks for q in qs)
