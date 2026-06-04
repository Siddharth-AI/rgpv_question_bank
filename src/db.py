"""SQLite storage + FTS5 index (SPEC.md §5.4)."""

from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any, Iterable

from src.parser import Question

DEFAULT_DB_PATH = Path("data/exam.db")


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS papers (
    id INTEGER PRIMARY KEY,
    subject_code TEXT NOT NULL,
    subject_name TEXT NOT NULL,
    year INTEGER NOT NULL,
    session TEXT NOT NULL,         -- 'JUN' or 'DEC'
    branch TEXT NOT NULL,
    semester INTEGER NOT NULL,
    source_pdf_path TEXT,
    source_pdf_url TEXT,
    UNIQUE(subject_code, year, session)
);

CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY,
    paper_id INTEGER REFERENCES papers(id) ON DELETE CASCADE,
    unit_number INTEGER,
    question_number TEXT,
    marks INTEGER,
    question_text TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_questions_paper ON questions(paper_id);
CREATE INDEX IF NOT EXISTS idx_questions_unit ON questions(unit_number);
CREATE INDEX IF NOT EXISTS idx_questions_marks ON questions(marks);

CREATE VIRTUAL TABLE IF NOT EXISTS questions_fts USING fts5(
    question_text,
    content='questions',
    content_rowid='id'
);

-- FTS sync triggers
CREATE TRIGGER IF NOT EXISTS questions_ai AFTER INSERT ON questions BEGIN
    INSERT INTO questions_fts(rowid, question_text) VALUES (new.id, new.question_text);
END;

CREATE TRIGGER IF NOT EXISTS questions_ad AFTER DELETE ON questions BEGIN
    INSERT INTO questions_fts(questions_fts, rowid, question_text) VALUES ('delete', old.id, old.question_text);
END;

CREATE TRIGGER IF NOT EXISTS questions_au AFTER UPDATE ON questions BEGIN
    INSERT INTO questions_fts(questions_fts, rowid, question_text) VALUES ('delete', old.id, old.question_text);
    INSERT INTO questions_fts(rowid, question_text) VALUES (new.id, new.question_text);
END;
"""


def connect(db_path: Path | str = DEFAULT_DB_PATH) -> sqlite3.Connection:
    p = Path(db_path)
    if p != Path(":memory:"):
        p.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(p, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db(db_path: Path | str = DEFAULT_DB_PATH) -> sqlite3.Connection:
    conn = connect(db_path)
    conn.executescript(SCHEMA_SQL)
    conn.commit()
    return conn


def insert_paper(conn: sqlite3.Connection, meta: dict[str, Any]) -> int:
    """Idempotent on UNIQUE(subject_code, year, session). Returns paper id."""
    required = ("subject_code", "subject_name", "year", "session", "branch", "semester")
    for k in required:
        if k not in meta:
            raise ValueError(f"insert_paper missing key: {k}")

    row = conn.execute(
        "SELECT id FROM papers WHERE subject_code=? AND year=? AND session=?",
        (meta["subject_code"], meta["year"], meta["session"]),
    ).fetchone()
    if row:
        # Refresh path/url in case scraper moved files
        conn.execute(
            "UPDATE papers SET source_pdf_path=?, source_pdf_url=? WHERE id=?",
            (meta.get("source_pdf_path"), meta.get("source_pdf_url"), row["id"]),
        )
        # Wipe old questions so a re-load reflects parser improvements.
        conn.execute("DELETE FROM questions WHERE paper_id=?", (row["id"],))
        conn.commit()
        return int(row["id"])

    cur = conn.execute(
        """
        INSERT INTO papers (subject_code, subject_name, year, session, branch, semester, source_pdf_path, source_pdf_url)
        VALUES (:subject_code, :subject_name, :year, :session, :branch, :semester, :source_pdf_path, :source_pdf_url)
        """,
        {
            "subject_code": meta["subject_code"],
            "subject_name": meta["subject_name"],
            "year": meta["year"],
            "session": meta["session"],
            "branch": meta["branch"],
            "semester": meta["semester"],
            "source_pdf_path": meta.get("source_pdf_path"),
            "source_pdf_url": meta.get("source_pdf_url"),
        },
    )
    conn.commit()
    return int(cur.lastrowid)


def insert_questions(conn: sqlite3.Connection, paper_id: int, questions: Iterable[Question]) -> int:
    rows = [
        (paper_id, q.unit_number, q.question_number, q.marks, q.question_text)
        for q in questions
        if q.question_text and q.question_text.strip()
    ]
    if not rows:
        return 0
    conn.executemany(
        "INSERT INTO questions (paper_id, unit_number, question_number, marks, question_text) VALUES (?,?,?,?,?)",
        rows,
    )
    conn.commit()
    return len(rows)


def rebuild_fts(conn: sqlite3.Connection) -> None:
    conn.execute("INSERT INTO questions_fts(questions_fts) VALUES ('rebuild')")
    conn.commit()


def counts(conn: sqlite3.Connection) -> dict[str, int]:
    return {
        "papers": conn.execute("SELECT COUNT(*) FROM papers").fetchone()[0],
        "questions": conn.execute("SELECT COUNT(*) FROM questions").fetchone()[0],
        "subjects": conn.execute("SELECT COUNT(DISTINCT subject_code) FROM papers").fetchone()[0],
    }
