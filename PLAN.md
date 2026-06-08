# PLAN.md — RGPV Exam Insights

Implementation plan. References [SPEC.md](SPEC.md) and [CLAUDE.md](CLAUDE.md). Do not duplicate spec content — section numbers cited.

---

## 1. Overview

Build a deployed web tool that ingests RGPV B.Tech CSE Sem-5 question paper PDFs, parses individual questions with unit/marks/number metadata, and serves keyword + filter search plus per-subject frequency analysis. Backend = FastAPI + SQLite/FTS5 (per SPEC §5.4, §5.5); frontend = Next.js 16 + R3F/GSAP shell per [CLAUDE.md](CLAUDE.md) theme. Workshop scope frozen to SPEC §2 (one branch, one semester, ~80 PDFs).

---

## 2. Milestones

| Phase | Goal | Files touched | Acceptance check | Estimated time |
|-------|------|---------------|------------------|----------------|
| P1 — Setup & Ingestion (SPEC §9 Phase 1) | Scrape + store PDFs idempotently per SPEC §5.1 | `src/scraper.py`, `data/raw/`, `requirements.txt`, `README.md` | ≥30 PDFs in `data/raw/<subject>/<year>-<session>.pdf`; rerun adds zero dupes | 45 min |
| P2 — Extraction & Parsing (SPEC §9 Phase 2) | PDF→text→structured questions per SPEC §5.2, §5.3 | `src/extractor.py`, `src/parser.py`, `tests/test_parser.py` | ≥80% parse rate on 20-question spot-check; failures logged not raised | 75 min |
| P3 — Storage & Search (SPEC §9 Phase 3) | SQLite schema + FTS5 load + query layer per SPEC §5.4, §5.5 | `src/db.py`, `src/search.py` | Schema matches SPEC §5.4 verbatim; FTS query returns <1s on full corpus | 60 min |
| P4 — API + UI + Frequency (SPEC §9 Phase 4) | FastAPI endpoints + Next.js UI + per-subject TF-IDF | `src/app.py`, `web/**` | All 4 endpoints from SPEC §5.5 return 200; UI filters per SPEC §5.6; top-10 terms render | 60 min |
| P5 — Deployment (SPEC §5.7) | Backend → Render, frontend → Vercel | `web/`, deploy configs, `.env.example` | Public URL reachable; SPEC §10 use case #1 completes end-to-end on prod | 30 min |
| P6 — Demo & Handover | Manual QA + screenshots + README finalize | `README.md`, screenshots | All SPEC §10 criteria checked; CLAUDE.md "before complete" gate satisfied | 20 min |

---

## 3. File-by-File Plan

Files enumerated per SPEC §8.

### `src/scraper.py`
- **Purpose:** Download RGPV PDFs from rgpvonline.com for chosen subjects (SPEC §5.1).
- **Public:** `discover_papers(branch, semester, subjects) -> list[PaperMeta]`, `download(meta) -> Path`, `run(config)`.
- **Deps:** stdlib `pathlib`, `requests`, `beautifulsoup4`. No project imports.
- **Test:** Mock HTTP; assert idempotent rerun (no dupe writes); assert path layout `data/raw/<subject>/<year>-<session>.pdf`.

### `src/extractor.py`
- **Purpose:** PDF → raw text preserving question boundaries and multi-column layout (SPEC §5.2).
- **Public:** `extract_text(pdf_path: Path) -> str`, `extract_pages(pdf_path: Path) -> list[str]`.
- **Deps:** `pymupdf` (`fitz`). No project imports.
- **Test:** Golden-text fixture on 1 known PDF; assert non-empty + contains "Unit" tokens.

### `src/parser.py`
- **Purpose:** Raw text → structured `Question` records per SPEC §5.3 schema.
- **Public:** `parse_paper(text: str, paper_meta) -> list[Question]`, `Question` dataclass (`unit_number`, `question_number`, `marks`, `question_text`).
- **Deps:** stdlib `re`, `dataclasses`, `logging`; imports `extractor` only for typing.
- **Test:** `tests/test_parser.py` covers 3 sample papers; asserts ≥80% extracted; asserts failures logged, no exceptions.

### `src/db.py`
- **Purpose:** SQLite connection, schema init, insert helpers, FTS sync (SPEC §5.4).
- **Public:** `connect(path) -> Connection`, `init_schema(conn)`, `insert_paper(conn, meta) -> int`, `insert_questions(conn, paper_id, questions)`, `rebuild_fts(conn)`.
- **Deps:** stdlib `sqlite3`; imports `parser.Question`.
- **Test:** In-memory DB; assert tables match SPEC §5.4 columns/types verbatim; FTS5 virtual table queryable.

### `src/search.py`
- **Purpose:** Query layer for keyword + filters + frequency (SPEC §5.5).
- **Public:** `list_subjects(conn)`, `search(conn, q, subject, unit, year_from, year_to, marks)`, `frequency(conn, subject, top_n=10)`, `question_detail(conn, qid)`.
- **Deps:** `db` for connection; `scikit-learn` TfidfVectorizer for frequency.
- **Test:** Seed fixture DB with 10 questions; assert filter combinations return expected rows; assert frequency returns 10 terms.

### `src/app.py`
- **Purpose:** FastAPI entry exposing SPEC §5.5 routes.
- **Public:** `app = FastAPI()`; routes `GET /subjects`, `GET /search`, `GET /frequency`, `GET /question/{id}`.
- **Deps:** `fastapi`, `uvicorn`; imports `db`, `search`. CORS open for Vercel origin.
- **Test:** `TestClient` hits each route; assert 200 + JSON shape; assert filter passthrough.

### `tests/test_parser.py`
- **Purpose:** Parser correctness gate per SPEC §5.3 acceptance.
- **Public:** pytest functions per sample paper.
- **Deps:** `pytest`, `parser`, `extractor`.
- **Test strategy:** Itself the test file. Fixtures in `tests/fixtures/` (real PDF excerpts).

### `requirements.txt`
- **Purpose:** Pin Python deps for reproducibility (SPEC §6).
- **Test:** `pip install -r requirements.txt` clean in fresh venv.

### `README.md`
- **Purpose:** Setup + run + deploy instructions (SPEC §6, §10 #6).
- **Test:** A fresh user follows steps and reaches `http://localhost:8000/docs` + `http://localhost:3000`.

### `SPEC.md`
- **Purpose:** Source of truth. Not edited during build.

### `web/` (extension beyond SPEC §8, per [CLAUDE.md])
- **Purpose:** Next.js 16 frontend implementing SPEC §5.6 UI on the dark-glass theme.
- **Public surface:** `app/page.tsx` (hero + search), `app/subject/[code]/page.tsx` (frequency view), `components/Hero3D.tsx`, `components/SearchPanel.tsx`, `components/QuestionCard.tsx`, `lib/api.ts`.
- **Deps:** API base URL from `.env.local` (`API_BASE_URL`).
- **Test:** `npm run build` clean; manual Lighthouse on `/`; visual check vs theme tokens in [CLAUDE.md].

---

## 4. Data Flow

```
rgpvonline.com
      │
      ▼
┌──────────────┐    data/raw/<subject>/<year>-<session>.pdf
│  scraper.py  │ ─────────────────────────────────┐
└──────────────┘                                  │
                                                  ▼
                                          ┌──────────────┐
                                          │ extractor.py │  PDF → raw text
                                          └──────┬───────┘
                                                 │
                                                 ▼
                                          ┌──────────────┐
                                          │  parser.py   │  text → Question[]
                                          └──────┬───────┘
                                                 │
                                                 ▼
                                          ┌──────────────┐
                                          │    db.py     │  SQLite + FTS5
                                          └──────┬───────┘
                                                 │
                                                 ▼
                                          ┌──────────────┐
                                          │  search.py   │  query + frequency
                                          └──────┬───────┘
                                                 │
                                                 ▼
                                          ┌──────────────┐
                                          │   app.py     │  FastAPI /search /frequency
                                          └──────┬───────┘
                                                 │ HTTPS/JSON
                                                 ▼
                                          ┌──────────────┐
                                          │  web/ (Next) │  hero + filters + charts
                                          └──────────────┘
```

---

## 5. Risk Log

Base risks copied from SPEC §12:

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| rgpvonline.com slow/blocks during workshop | Medium | Pre-download PDFs day before; ship as zip |
| PDF parser fails on older papers (pre-2015) | High | Scope to 2017+; older as stretch |
| Some PDFs are scanned images | Low | Skip non-text PDFs; log them |
| Team stuck on regex hell | Medium | Provide starter parser handling 50%; iterate |
| Deployment signup eats time | Medium | Pre-create accounts; cheat sheet |

Frontend-specific additions:

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| 3D hero perf tanks on low-end laptops | High | Gate `Hero3D` behind `prefers-reduced-motion` + low-DPR fallback; static gradient blob SVG as substitute |
| GSAP scroll-trigger hydration mismatch (Next 16 RSC) | Medium | Wrap GSAP in `'use client'` + `useLayoutEffect` inside `useEffect` guard; register plugins client-only |

---

## 6. Definition of Done

Copied from SPEC §10:

- [ ] ≥30 PDFs ingested for chosen subjects
- [ ] ≥80% questions correctly parsed (manual spot-check 20 random)
- [ ] Search works on keyword + ≥2 filters
- [ ] Frequency view shows top 10 repeated terms per subject
- [ ] App deployed at public URL
- [ ] `README.md` documents local run

Additional UI gates ([CLAUDE.md] theme + perf):

- [ ] Hero blob (Three.js distorted icosahedron, violet→cyan) renders without errors
- [ ] Search input debounced (≥250ms) — no per-keystroke API spam
- [ ] Frequency chart first paint <2s on cold load
- [ ] Lighthouse perf score ≥85 on `/` (mobile profile)

---

## 7. Daily Checkpoints

End-of-phase commits. Use exact messages:

1. End of P1 — `feat(ingest): scrape and store RGPV PDFs idempotently (SPEC §5.1)`
2. End of P2 — `feat(parse): extract structured questions with ≥80% parse rate (SPEC §5.3)`
3. End of P3 — `feat(db): sqlite schema + FTS5 search layer (SPEC §5.4, §5.5)`
4. End of P4 — `feat(app): FastAPI endpoints + Next.js UI with frequency view (SPEC §5.5, §5.6)`

Deployment (P5) and demo (P6) follow with: `chore(deploy): backend on Render, frontend on Vercel (SPEC §5.7)` and `docs(readme): final setup + acceptance evidence (SPEC §10)`.

---

*End of plan. Awaiting approval before Phase 1.*
