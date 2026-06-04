"""RGPV question paper text -> structured questions (SPEC.md §5.3).

State-machine + small regexes. Filters bilingual Hindi blocks via english-char
ratio. Logs every skipped line to logs/parser.log instead of raising.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

LOG_DIR = Path("logs")
LOG_DIR.mkdir(exist_ok=True)
_handler = logging.FileHandler(LOG_DIR / "parser.log", encoding="utf-8")
_handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)-5s %(message)s"))
log = logging.getLogger("parser")
log.addHandler(_handler)
log.setLevel(logging.INFO)


# ---------- Regexes ----------
# Main question header. Examples: "1.", "1. a)", "10. b)", "1. a) text follows...".
# Capture optional inline body after the header on the same line.
RE_MAIN = re.compile(r"^\s*(\d{1,2})\.\s*(?:([a-cA-C])\))?\s*(.*?)\s*$")
# Sub-part header. Examples: "a)", "b)", "c)", "a) inline text".
RE_SUB = re.compile(r"^\s*([a-cA-C])\)\s*(.*?)\s*$")
# Bare marks line: a small integer alone. Page-number `[1]` requires brackets.
RE_BARE_MARKS = re.compile(r"^\s*(\d{1,2})\s*$")
# Trailing marks on a content line: "... some text 7"
RE_TRAILING_MARKS = re.compile(r"^(.*?\S)\s+(\d{1,2})\s*$")
# Bracketed page number: "[1]", "[ 2 ]"
RE_PAGE_NUM = re.compile(r"^\s*\[\s*\d{1,3}\s*\]\s*$")

# Header / footer noise
NOISE_PATTERNS = [
    re.compile(r"^\s*$"),
    re.compile(r"^https?://", re.I),
    re.compile(r"^\s*PTO\s*$", re.I),
    re.compile(r"^\s*Contd\.{0,3}\s*$", re.I),
    re.compile(r"^\s*Roll\s*No", re.I),
    re.compile(r"^\s*Total\s+No\.\s*of", re.I),
    re.compile(r"^\s*Time\s*:", re.I),
    re.compile(r"^\s*Maximum\s+Marks", re.I),
    re.compile(r"^\s*Note\s*:", re.I),
    re.compile(r"^\s*(All|Attempt)\s+", re.I),
    re.compile(r"^\s*B\.\s*Tech", re.I),
    re.compile(r"^\s*Examination", re.I),
    re.compile(r"^\s*Choice\s+Based", re.I),
    re.compile(r"^\s*[A-Z]{1,4}-\d{3}(-[A-Z]+)*(-CBGS|-CBCS|-NEP)?\s*$"),
    re.compile(r"^\s*[ivxIVX]+\)\s*$"),  # roman-numeral list marker lines
]

# Tokens that look like garbled Hindi-font extraction.
# Note: `>` `<` `|` `$` appear inside RGPV-font Devanagari (e.g. `S>oQ>m`, `H$`).
GARBLE_CHARS = set("$¶§|°«ñ©®ºªµø<>")
# Standalone question-mark tokens or tokens that are mostly `?` come from
# the same broken font and should be dropped.
RE_QMARK_HEAVY = re.compile(r"^\?+$")
HEADER_RE = re.compile(r"Maximum\s+Marks\s*:\s*(\d{1,3})", re.I)
ATTEMPT_RE = re.compile(r"(?:Attempt|Answer)\s+any\s+(\w+)", re.I)
WORD_TO_NUM = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "ten": 10}


@dataclass
class Question:
    unit_number: int | None
    question_number: str
    marks: int | None
    question_text: str


@dataclass
class _Acc:
    """Mutable accumulator while building one Question."""
    main_no: int | None = None
    sub: str | None = None
    marks: int | None = None
    lines: list[str] = field(default_factory=list)

    def has_content(self) -> bool:
        return bool(self.main_no and self.lines)

    def qno(self) -> str:
        return f"Q{self.main_no}({self.sub})" if self.sub else f"Q{self.main_no}"


# ---------- Helpers ----------
def _is_noise(line: str) -> bool:
    if RE_PAGE_NUM.match(line):
        return True
    for pat in NOISE_PATTERNS:
        if pat.match(line):
            return True
    return False


def _english_ratio(text: str) -> float:
    if not text:
        return 0.0
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return 0.0
    ascii_letters = sum(1 for c in letters if c.isascii())
    return ascii_letters / len(letters)


def _is_garble_token(tok: str) -> bool:
    if not tok:
        return True
    if any(c in GARBLE_CHARS for c in tok):
        return True
    if RE_QMARK_HEAVY.match(tok):
        return True
    # tokens that are mostly `?` (RGPV bilingual extraction noise)
    if tok.count("?") >= 2 and tok.count("?") >= len(tok) // 2:
        return True
    if _english_ratio(tok) < 0.5:
        return True
    return False


def _looks_hindi(line: str) -> bool:
    """RGPV Hindi lines arrive as garbled ASCII (custom Devanagari font).
    Detect by counting garble tokens, not unicode."""
    stripped = line.strip()
    if len(stripped) <= 4:
        return False
    tokens = stripped.split()
    if not tokens:
        return False
    garble = sum(1 for t in tokens if _is_garble_token(t))
    return (garble / len(tokens)) >= 0.5


def _clean_text(text: str) -> str:
    """Drop garbled glyph tokens; collapse whitespace."""
    return " ".join(t for t in text.split() if not _is_garble_token(t)).strip()


def _unit_for(qno: int) -> int:
    return min(((qno - 1) // 2) + 1, 5)


def _infer_marks_from_header(text: str) -> int | None:
    """Returns per-main marks from 'Maximum Marks : N' + 'Attempt any K'."""
    m_max = HEADER_RE.search(text)
    if not m_max:
        return None
    try:
        total = int(m_max.group(1))
    except ValueError:
        return None
    m_attempt = ATTEMPT_RE.search(text)
    if not m_attempt:
        return None
    raw = m_attempt.group(1).strip().lower()
    k = WORD_TO_NUM.get(raw)
    if k is None:
        try:
            k = int(raw)
        except ValueError:
            return None
    if k <= 0:
        return None
    return max(1, round(total / k))


# ---------- Main parser ----------
def parse_paper(text: str, paper_meta: dict[str, Any] | None = None) -> list[Question]:
    """Parse extracted paper text into a list of Question records.

    paper_meta is optional, kept for caller-side context (year/subject/etc.).
    """
    label = (paper_meta or {}).get("label", "<unknown>")
    questions: list[Question] = []
    acc = _Acc()
    last_main_no: int | None = None
    per_main_marks_fallback = _infer_marks_from_header(text)

    def finalize() -> None:
        if not acc.has_content():
            return
        cleaned = _clean_text(" ".join(acc.lines))
        if len(cleaned) < 10:
            log.info("[%s] drop empty/short Q%s", label, acc.qno())
            _reset()
            return
        marks = acc.marks if acc.marks is not None else per_main_marks_fallback
        questions.append(
            Question(
                unit_number=_unit_for(acc.main_no) if acc.main_no else None,
                question_number=acc.qno(),
                marks=marks,
                question_text=cleaned,
            )
        )
        _reset()

    def _reset() -> None:
        acc.main_no = None
        acc.sub = None
        acc.marks = None
        acc.lines = []

    for raw in text.splitlines():
        line = raw.rstrip()
        if _is_noise(line):
            continue

        m_main = RE_MAIN.match(line)
        if m_main:
            finalize()
            try:
                acc.main_no = int(m_main.group(1))
            except ValueError:
                continue
            last_main_no = acc.main_no
            acc.sub = (m_main.group(2) or "").lower() or None
            inline = (m_main.group(3) or "").strip()
            if inline and not _looks_hindi(inline):
                acc.lines.append(inline)
            continue

        m_sub = RE_SUB.match(line)
        if m_sub:
            finalize()
            acc.main_no = last_main_no
            acc.sub = m_sub.group(1).lower()
            inline = (m_sub.group(2) or "").strip()
            if inline and not _looks_hindi(inline):
                acc.lines.append(inline)
            continue

        if not acc.main_no and last_main_no is None:
            # Preamble text before first question — skip.
            continue

        if _looks_hindi(line):
            continue

        m_bare = RE_BARE_MARKS.match(line)
        if m_bare:
            try:
                val = int(m_bare.group(1))
            except ValueError:
                continue
            if 1 <= val <= 20:
                acc.marks = val
                # Marks line typically follows the question; finalize once we have any content.
                if acc.lines:
                    finalize()
                continue

        m_trail = RE_TRAILING_MARKS.match(line)
        if m_trail:
            body, val_s = m_trail.group(1), m_trail.group(2)
            try:
                val = int(val_s)
            except ValueError:
                val = -1
            if 1 <= val <= 20 and len(body.split()) >= 3:
                acc.lines.append(body)
                acc.marks = val
                finalize()
                continue

        acc.lines.append(line.strip())

    finalize()
    log.info("[%s] parsed %d questions (per_main_marks_fallback=%s)", label, len(questions), per_main_marks_fallback)
    return questions


def parse_file(pdf_or_text_path: Path | str, paper_meta: dict[str, Any] | None = None) -> list[Question]:
    """Convenience: read a .txt sidecar, else extract from PDF then parse."""
    from src.extractor import extract_text

    p = Path(pdf_or_text_path)
    if p.suffix.lower() == ".txt":
        text = p.read_text(encoding="utf-8", errors="ignore")
    else:
        text = extract_text(p)
    meta = dict(paper_meta or {})
    meta.setdefault("label", p.name)
    return parse_paper(text, meta)
