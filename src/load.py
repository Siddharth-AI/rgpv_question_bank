"""Walk data/raw/, extract+parse every PDF, persist to SQLite."""

from __future__ import annotations

import argparse
import logging
import re
import sys
from pathlib import Path

from src.db import counts, init_db, insert_paper, insert_questions
from src.extractor import extract_text
from src.parser import parse_paper
from src.scraper import BASE, SUBJECTS

log = logging.getLogger("load")

RE_FILENAME = re.compile(r"^(?P<year>\d{4})-(?P<session>JUN|DEC)\.pdf$", re.I)


def _iter_pdfs(root: Path):
    for subject_dir in sorted(p for p in root.iterdir() if p.is_dir()):
        code = subject_dir.name
        for pdf in sorted(subject_dir.glob("*.pdf")):
            yield code, pdf


def load_all(data_root: Path = Path("data/raw"), db_path: Path = Path("data/exam.db")) -> dict:
    conn = init_db(db_path)
    loaded = 0
    skipped: list[tuple[str, str]] = []
    total_questions = 0

    for code, pdf in _iter_pdfs(data_root):
        if code not in SUBJECTS:
            skipped.append((pdf.as_posix(), f"unknown subject_code={code}"))
            continue
        m = RE_FILENAME.match(pdf.name)
        if not m:
            skipped.append((pdf.as_posix(), "bad filename"))
            continue
        year = int(m.group("year"))
        session = m.group("session").upper()
        slug, subject_name, semester, branch = SUBJECTS[code]

        meta = {
            "subject_code": code,
            "subject_name": subject_name,
            "year": year,
            "session": session,
            "branch": branch,
            "semester": semester,
            "source_pdf_path": pdf.as_posix(),
            "source_pdf_url": f"{BASE}/be/{slug}-{session.lower()}-{year}.pdf",
        }

        try:
            text = extract_text(pdf)
        except Exception as exc:
            skipped.append((pdf.as_posix(), f"extract error: {exc}"))
            continue

        questions = parse_paper(text, {"label": f"{code}/{year}-{session}"})
        if not questions:
            skipped.append((pdf.as_posix(), "parser returned 0 questions"))
            continue

        paper_id = insert_paper(conn, meta)
        n = insert_questions(conn, paper_id, questions)
        total_questions += n
        loaded += 1
        log.info("LOAD %s/%s-%s -> paper_id=%d questions=%d", code, year, session, paper_id, n)

    db_counts = counts(conn)
    log.info("DONE loaded=%d total_questions=%d skipped=%d db=%s", loaded, total_questions, len(skipped), db_counts)
    return {"loaded": loaded, "total_questions": total_questions, "skipped": skipped, "db": db_counts}


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Load parsed RGPV questions into SQLite.")
    p.add_argument("--data-root", default="data/raw", type=Path)
    p.add_argument("--db", default="data/exam.db", type=Path)
    p.add_argument("-v", "--verbose", action="store_true")
    args = p.parse_args(argv if argv is not None else sys.argv[1:])
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)-5s %(name)s :: %(message)s",
    )
    summary = load_all(args.data_root, args.db)
    print("\n=== LOAD SUMMARY ===")
    print(f"papers loaded     : {summary['loaded']}")
    print(f"questions inserted: {summary['total_questions']}")
    print(f"skipped           : {len(summary['skipped'])}")
    for path, reason in summary["skipped"][:20]:
        print(f"  - {path} :: {reason}")
    if len(summary["skipped"]) > 20:
        print(f"  ... and {len(summary['skipped']) - 20} more")
    print(f"db counts         : {summary['db']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
