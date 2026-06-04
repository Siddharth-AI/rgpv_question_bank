"""Tests for src/db.py (SPEC.md §5.4)."""

from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest

from src.db import counts, init_db, insert_paper, insert_questions, rebuild_fts
from src.parser import Question


META = {
    "subject_code": "CS-502",
    "subject_name": "Database Management Systems",
    "year": 2020,
    "session": "JUN",
    "branch": "CSE",
    "semester": 5,
    "source_pdf_path": "data/raw/CS-502/2020-JUN.pdf",
    "source_pdf_url": "https://example.com/x.pdf",
}


def _qs() -> list[Question]:
    return [
        Question(1, "Q1(a)", 7, "Define BCNF and explain with example."),
        Question(1, "Q1(b)", 7, "What is normalization in DBMS theory?"),
        Question(2, "Q2(a)", 7, "Explain transaction isolation levels."),
    ]


def test_schema_columns_match_spec(tmp_path: Path):
    db = tmp_path / "x.db"
    conn = init_db(db)
    cols_papers = {r[1] for r in conn.execute("PRAGMA table_info(papers)").fetchall()}
    expected_papers = {"id", "subject_code", "subject_name", "year", "session", "branch", "semester", "source_pdf_path", "source_pdf_url"}
    assert expected_papers.issubset(cols_papers)

    cols_q = {r[1] for r in conn.execute("PRAGMA table_info(questions)").fetchall()}
    assert {"id", "paper_id", "unit_number", "question_number", "marks", "question_text"}.issubset(cols_q)

    # FTS5 virtual table exists
    row = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='questions_fts'").fetchone()
    assert row is not None


def test_insert_and_query_roundtrip(tmp_path: Path):
    conn = init_db(tmp_path / "x.db")
    pid = insert_paper(conn, META)
    assert pid > 0
    n = insert_questions(conn, pid, _qs())
    assert n == 3

    c = counts(conn)
    assert c["papers"] == 1
    assert c["questions"] == 3
    assert c["subjects"] == 1


def test_insert_paper_idempotent(tmp_path: Path):
    conn = init_db(tmp_path / "x.db")
    pid1 = insert_paper(conn, META)
    insert_questions(conn, pid1, _qs())
    pid2 = insert_paper(conn, META)  # same key → same id, questions wiped
    insert_questions(conn, pid2, _qs())
    assert pid1 == pid2
    c = counts(conn)
    assert c["papers"] == 1
    assert c["questions"] == 3


def test_fts_match_returns_inserted_question(tmp_path: Path):
    conn = init_db(tmp_path / "x.db")
    pid = insert_paper(conn, META)
    insert_questions(conn, pid, _qs())
    rows = conn.execute(
        "SELECT q.question_text FROM questions_fts f JOIN questions q ON q.id=f.rowid WHERE questions_fts MATCH ?",
        ("BCNF",),
    ).fetchall()
    assert len(rows) == 1
    assert "BCNF" in rows[0]["question_text"]


def test_fts_rebuild_recovers_index(tmp_path: Path):
    conn = init_db(tmp_path / "x.db")
    pid = insert_paper(conn, META)
    insert_questions(conn, pid, _qs())
    # clear FTS rows then rebuild
    conn.execute("INSERT INTO questions_fts(questions_fts) VALUES ('delete-all')")
    conn.commit()
    rebuild_fts(conn)
    rows = conn.execute(
        "SELECT rowid FROM questions_fts WHERE questions_fts MATCH ?",
        ("normalization",),
    ).fetchall()
    assert len(rows) >= 1
