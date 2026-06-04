"""Push local SQLite corpus to Supabase Postgres.

Reads data/exam.db, uploads papers + questions, and writes precomputed
per-subject TF-IDF frequencies (top 20) into subject_frequencies.

Env required:
- NEXT_PUBLIC_SUPABASE_URL  (or SUPABASE_URL)
- SUPABASE_SERVICE_ROLE_KEY  (bypasses RLS)
"""

from __future__ import annotations

import logging
import os
import sqlite3
import sys
from pathlib import Path

from sklearn.feature_extraction.text import TfidfVectorizer
from supabase import Client, create_client

LOG = logging.getLogger("upload")
SQLITE_PATH = Path(os.environ.get("RGPV_DB_PATH", "data/exam.db"))
BATCH = 500


def _client() -> Client:
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise SystemExit("Set NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY")
    return create_client(url, key)


def _clean(text: str) -> str:
    if not text:
        return ""
    garble = set("$¶§|°«ñ©®ºªµø<>")
    out = []
    for tok in text.split():
        if any(c in garble for c in tok):
            continue
        letters = [c for c in tok if c.isalpha()]
        if letters:
            ascii_ratio = sum(1 for c in letters if c.isascii()) / len(letters)
            if ascii_ratio < 0.5:
                continue
        out.append(tok)
    return " ".join(out).strip()


def upload(sqlite_path: Path = SQLITE_PATH) -> None:
    if not sqlite_path.exists():
        raise SystemExit(f"SQLite DB not found at {sqlite_path}. Run `python -m src.load` first.")
    sb = _client()

    conn = sqlite3.connect(sqlite_path)
    conn.row_factory = sqlite3.Row

    # ---- Wipe target tables (idempotent reload) ----
    LOG.info("wiping target tables…")
    sb.table("subject_frequencies").delete().neq("subject_code", "__none__").execute()
    sb.table("questions").delete().neq("id", -1).execute()
    sb.table("papers").delete().neq("id", -1).execute()

    # ---- Upload papers ----
    papers = [dict(r) for r in conn.execute("SELECT * FROM papers").fetchall()]
    LOG.info("uploading %d papers…", len(papers))
    id_map: dict[int, int] = {}
    for i in range(0, len(papers), BATCH):
        chunk = papers[i : i + BATCH]
        payload = [
            {
                "subject_code": p["subject_code"],
                "subject_name": p["subject_name"],
                "year": p["year"],
                "session": p["session"],
                "branch": p["branch"],
                "semester": p["semester"],
                "source_pdf_path": p["source_pdf_path"],
                "source_pdf_url": p["source_pdf_url"],
            }
            for p in chunk
        ]
        resp = sb.table("papers").insert(payload).execute()
        for old, new_row in zip(chunk, resp.data):
            id_map[int(old["id"])] = int(new_row["id"])
        LOG.info("  papers %d/%d", min(i + BATCH, len(papers)), len(papers))

    # ---- Upload questions ----
    questions = [dict(r) for r in conn.execute("SELECT * FROM questions").fetchall()]
    LOG.info("uploading %d questions…", len(questions))
    for i in range(0, len(questions), BATCH):
        chunk = questions[i : i + BATCH]
        payload = []
        for q in chunk:
            cleaned = _clean(q["question_text"])
            if not cleaned:
                continue
            payload.append({
                "paper_id": id_map[int(q["paper_id"])],
                "unit_number": q["unit_number"],
                "question_number": q["question_number"],
                "marks": q["marks"],
                "question_text": cleaned,
            })
        if payload:
            sb.table("questions").insert(payload).execute()
        LOG.info("  questions %d/%d", min(i + BATCH, len(questions)), len(questions))

    # ---- Compute frequencies ----
    LOG.info("computing per-subject TF-IDF frequencies…")
    subjects = {p["subject_code"] for p in papers}
    rows: list[dict] = []
    for code in sorted(subjects):
        docs_sql = """
            SELECT q.question_text FROM questions q
            JOIN papers p ON p.id = q.paper_id
            WHERE p.subject_code = ?
        """
        docs = [_clean(r["question_text"]) for r in conn.execute(docs_sql, (code,)).fetchall()]
        docs = [d for d in docs if len(d.split()) >= 3]
        if len(docs) < 2:
            continue
        try:
            vec = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), max_features=500)
            matrix = vec.fit_transform(docs)
        except ValueError:
            continue
        scores = matrix.sum(axis=0).A1
        terms = vec.get_feature_names_out()
        paired = sorted(zip(terms, scores), key=lambda t: -t[1])[:20]
        for rank, (term, score) in enumerate(paired, start=1):
            rows.append({
                "subject_code": code,
                "rank": rank,
                "term": str(term),
                "score": float(score),
            })

    LOG.info("uploading %d frequency rows for %d subjects…", len(rows), len(subjects))
    for i in range(0, len(rows), BATCH):
        sb.table("subject_frequencies").insert(rows[i : i + BATCH]).execute()

    conn.close()
    LOG.info("DONE")


def main() -> int:
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)-5s %(message)s"
    )
    upload()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
