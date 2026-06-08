-- RGPV Exam Insights — Supabase Postgres schema
-- Run in Supabase SQL editor. Idempotent.

CREATE TABLE IF NOT EXISTS papers (
    id BIGSERIAL PRIMARY KEY,
    subject_code TEXT NOT NULL,
    subject_name TEXT NOT NULL,
    year INTEGER NOT NULL,
    session TEXT NOT NULL,           -- 'JUN' or 'DEC'
    branch TEXT NOT NULL,
    semester INTEGER NOT NULL,
    source_pdf_path TEXT,
    source_pdf_url TEXT,
    UNIQUE (subject_code, year, session)
);

CREATE TABLE IF NOT EXISTS questions (
    id BIGSERIAL PRIMARY KEY,
    paper_id BIGINT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    unit_number INTEGER,
    question_number TEXT,
    marks INTEGER,
    question_text TEXT NOT NULL,
    tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', question_text)) STORED
);

CREATE INDEX IF NOT EXISTS idx_questions_paper ON questions(paper_id);
CREATE INDEX IF NOT EXISTS idx_questions_unit ON questions(unit_number);
CREATE INDEX IF NOT EXISTS idx_questions_marks ON questions(marks);
CREATE INDEX IF NOT EXISTS idx_questions_tsv ON questions USING GIN(tsv);

CREATE TABLE IF NOT EXISTS subject_frequencies (
    subject_code TEXT NOT NULL,
    rank INTEGER NOT NULL,
    term TEXT NOT NULL,
    score DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (subject_code, rank)
);

CREATE INDEX IF NOT EXISTS idx_freq_subject ON subject_frequencies(subject_code);

-- Disable RLS per project requirement (workshop scope, service-role-only writes)
ALTER TABLE papers DISABLE ROW LEVEL SECURITY;
ALTER TABLE questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE subject_frequencies DISABLE ROW LEVEL SECURITY;

-- Aggregate view used by /api/subjects and /api/branches.
CREATE OR REPLACE VIEW subject_stats AS
SELECT
    p.subject_code,
    MAX(p.subject_name) AS subject_name,
    MAX(p.branch) AS branch,
    MAX(p.semester) AS semester,
    COUNT(DISTINCT p.id) AS papers,
    COUNT(q.id) AS questions
FROM papers p
LEFT JOIN questions q ON q.paper_id = p.id
GROUP BY p.subject_code;

CREATE OR REPLACE VIEW branch_stats AS
SELECT
    p.branch,
    COUNT(DISTINCT p.subject_code) AS subjects,
    COUNT(DISTINCT p.id) AS papers,
    COUNT(q.id) AS questions
FROM papers p
LEFT JOIN questions q ON q.paper_id = p.id
GROUP BY p.branch
ORDER BY p.branch;
