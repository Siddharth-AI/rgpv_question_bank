# RGPV Exam Insights — Specification

## 1. Problem Statement

RGPV (Rajiv Gandhi Proudyogiki Vishwavidyalaya) B.Tech students preparing for exams have no way to see *which individual questions recur across years*. Past papers exist as scattered PDFs on rgpvonline.com — one file per (subject × year × session), many of them scanned images. There is no search, no per-subject frequency analysis, no cross-year view.

This project ingests those PDFs, extracts and parses individual questions, and ships a web app where a student can:

- Full-text search every question ever asked, filtered by subject, unit, marks, year range, and branch.
- See per-subject term frequency (TF-IDF) as a chart + word cloud to spot high-yield topics.
- Jump from a frequency term straight into a pre-filtered search.

## 2. Goals & Non-Goals

**Goals**

- Scrape B.Tech question papers for branches CSE, IT, EC, ME, semesters 3–8, years 2018–2025.
- Extract text (OCR fallback for scanned pages) and parse into structured questions at ≥80% rate.
- Store in Supabase Postgres with `tsvector` full-text search.
- Serve a dark, glassmorphic Next.js frontend + API on Vercel.
- Precompute per-subject TF-IDF frequency at ingest time.

**Non-Goals**

- No user accounts, auth, or personalization.
- No answer keys or solutions — questions only.
- No live scraping on the server. Ingest is local-only.
- No write path from the web app — read-only over Supabase.

## 3. Users & Use Cases

- **Exam-prepping student** — searches a topic ("BCNF"), sees every year it appeared, filters by marks to gauge weight.
- **Topic spotter** — opens a subject's insights page, reads the frequency chart/word cloud to prioritize study.
- **Browser** — lands on hero, explores by branch → subject without a specific query.

## 4. Architecture Overview

Two execution domains:

1. **Ingest (local only)** — Python pipeline on the developer's laptop. Never runs on Vercel (serverless = Node, ~10 s cap, no persistent disk; the scraper hits 1500+ URLs and OCR runs ~10 s/page).
2. **Web (Vercel)** — Next.js App Router serves both pages and `/api/*` route handlers in one deploy. Reads Supabase directly via service-role key (server-only).

Supabase Postgres is the shared store. Ingest pushes via service-role key; web reads via the same key from server-side route handlers.

### 4.1 Data Flow

```
PDFs (rgpvonline.com)
   → scraper.py      (download to data/raw/<code>/<year>-<SESSION>.pdf)
   → extractor.py    (PyMuPDF text + rapidocr OCR fallback)
   → parser.py       (regex → Question records, ≥80% rate)
   → db.py / load.py (SQLite cache: papers + questions, FTS5)
   → upload_supabase (wipe + reload Supabase, compute TF-IDF)
   → Supabase Postgres (tsvector FTS, GIN index, subject_frequencies)
   → Next.js /api/*  (force-dynamic route handlers)
   → Frontend        (hero, search, insights)
```

## 5. Ingestion Pipeline

### 5.1 Scrape

- PDFs live at `/be/<slug>-<session>-<year>.pdf` — **not** site root.
- URL slug ≠ subject code: slugs carry multi-branch prefixes (e.g. `ad-ai-al-cd-cs-...`). Store the full slug per subject.
- Coverage is sparse: ~3 of ~18 (year × session) combinations hit per subject.
- Polite: custom User-Agent `PCST-Workshop-Bot/0.1`, 0.4 s sleep, idempotent (skip existing non-empty files). robots.txt disallows non-Google bots — workshop scale, low volume, deviation documented.

### 5.2 Extract

- PyMuPDF (`fitz`), layout-aware via `page.get_text("blocks")` sorted x-bucket then y (two-column papers).
- OCR fallback: when a page yields <50 chars, render at 200 DPI and run `rapidocr-onnxruntime` (pure-python, no tesseract binary). Most 2022+ papers are scanned images.
- Skip a page only if both native text and OCR yield <50 chars.

### 5.3 Parse

- **Target: ≥80% extraction rate.**
- `Question` dataclass: `unit_number, question_number, marks, question_text`.
- RGPV pattern: main header (`N.` / `N. a)`), sub header (`a)`/`b)`/`c)`), marks (bare int line or trailing int), page numbers (`[1]` with literal brackets).
- Page-number regex MUST require literal brackets (`^\[\s*\d+\s*\]$`) — a bare `7` is marks, not a page number.
- Track `last_main_no` so a sub-header after a finalize restores the parent number.
- Two paper flavours: bare per-part marks, or no per-question marks. For the latter, infer per-main = `Maximum Marks : N` / `Attempt any K`.
- `unit_number = min(((qno-1)//2)+1, 5)`.
- Hindi-junk filter: bilingual papers ship Hindi as ASCII garble (custom Devanagari font). Token-level garble check (drop line if ≥50% tokens contain `$ ¶ § | ° « ñ © ® < >` or are mostly `?`). English-letter ratio alone misclassifies.
- Log skipped lines to `logs/parser.log` — never raise.

### 5.4 Schema (SQL)

```sql
CREATE TABLE IF NOT EXISTS papers (
  id BIGSERIAL PRIMARY KEY,
  subject_code TEXT NOT NULL,
  subject_name TEXT,
  year INT,
  session TEXT,
  branch TEXT,
  semester INT,
  source_pdf_path TEXT,
  source_pdf_url TEXT,
  UNIQUE (subject_code, year, session)
);

CREATE TABLE IF NOT EXISTS questions (
  id BIGSERIAL PRIMARY KEY,
  paper_id BIGINT REFERENCES papers(id) ON DELETE CASCADE,
  unit_number INT,
  question_number TEXT,
  marks INT,
  question_text TEXT NOT NULL,
  tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', question_text)) STORED
);

CREATE INDEX IF NOT EXISTS idx_questions_paper  ON questions (paper_id);
CREATE INDEX IF NOT EXISTS idx_questions_unit   ON questions (unit_number);
CREATE INDEX IF NOT EXISTS idx_questions_marks  ON questions (marks);
CREATE INDEX IF NOT EXISTS idx_questions_tsv    ON questions USING GIN (tsv);

CREATE TABLE IF NOT EXISTS subject_frequencies (
  subject_code TEXT,
  rank INT,
  term TEXT,
  score DOUBLE PRECISION,
  PRIMARY KEY (subject_code, rank)
);

ALTER TABLE papers              DISABLE ROW LEVEL SECURITY;
ALTER TABLE questions           DISABLE ROW LEVEL SECURITY;
ALTER TABLE subject_frequencies DISABLE ROW LEVEL SECURITY;

CREATE OR REPLACE VIEW subject_stats AS
  SELECT p.subject_code, p.subject_name,
         COUNT(DISTINCT p.id) AS papers,
         COUNT(q.id)          AS questions
  FROM papers p
  LEFT JOIN questions q ON q.paper_id = p.id
  GROUP BY p.subject_code, p.subject_name;

CREATE OR REPLACE VIEW branch_stats AS
  SELECT p.branch,
         COUNT(DISTINCT p.subject_code) AS subjects,
         COUNT(DISTINCT p.id)           AS papers,
         COUNT(q.id)                    AS questions
  FROM papers p
  LEFT JOIN questions q ON q.paper_id = p.id
  GROUP BY p.branch;
```

### 5.5 Upload

- Env: `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (service-role bypasses RLS, but cannot run raw DDL via REST — apply `schema.sql` via the SQL editor).
- Wipe-and-reload: `DELETE subject_frequencies`, `DELETE questions`, `DELETE papers`. Push papers then questions in batches of 500; remap `paper_id`.
- Apply `cleanText` before upload to strip garble (cheaper than re-parsing).
- TF-IDF (`sklearn`, `stop_words='english'`, `ngram_range=(1,2)`, `max_features=500`); store top-20 terms per subject in `subject_frequencies`.

## 6. API

All routes are Next.js App Router handlers under `web/app/api/*/route.ts`. Each: `export const dynamic = "force-dynamic"`. `/search` and `/frequency` soft-fail (return `[]` on Supabase error — malformed FTS must not 500). `cleanText` runs on every returned `question_text`.

## 7. API Endpoints

| Method | Endpoint | Params | Returns |
|--------|----------|--------|---------|
| GET | `/api/health` | — | `{status:"ok"}` (Supabase ping) |
| GET | `/api/stats` | — | `{papers, questions, subjects, year_from, year_to}` |
| GET | `/api/branches` | — | branch_stats rows |
| GET | `/api/subjects` | `branch` | subject_stats rows |
| GET | `/api/search` | `q, subject, unit, year_from, year_to, marks, branch, limit` | question rows (textSearch on `tsv`, `type:"websearch"`) |
| GET | `/api/frequency` | `subject, top_n` | subject_frequencies rows |
| GET | `/api/question/[id]` | path `id` | question + paper join; 404 on miss |
| GET | `/api/random` | `subject, branch` | one random question (count then offset) |

## 8. Folder Tree

```
.
├── src/                   # Python ingest (local only)
│   ├── __init__.py
│   ├── scraper.py
│   ├── extractor.py
│   ├── parser.py
│   ├── db.py
│   ├── load.py
│   └── upload_supabase.py
├── tests/
│   ├── test_parser.py
│   ├── test_extractor.py
│   └── test_db.py
├── supabase/
│   └── schema.sql
├── data/
│   ├── raw/.gitkeep
│   └── processed/.gitkeep
├── web/                   # Next.js (Vercel root)
│   ├── app/
│   │   ├── api/*/route.ts
│   │   ├── search/page.tsx
│   │   ├── insights/page.tsx
│   │   ├── insights/[subject]/page.tsx
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── ui/            # GlassCard, GradientButton, Input, Select, Tag, NavBar
│   │   ├── three/HeroScene.tsx
│   │   ├── AnimatedCount.tsx
│   │   └── StatusPill.tsx
│   ├── lib/               # supabase.ts (server-only), api.ts, useDebounced.ts
│   └── package.json
├── requirements.txt
├── .env.example
├── .gitignore
├── CLAUDE.md
├── SPEC.md
└── README.md
```

## 9. Frontend

**Theme (non-negotiable):** dark elegant glassmorphism. bg `#0A0A0F`, surface `#12121A` backdrop-blur, border `rgba(255,255,255,0.08)`. Violet→cyan gradient (`#7C5CFF → #00D4FF`), rose accent `#FF6B9D`. Instrument Serif display, Inter body, JetBrains Mono code. `rounded-2xl` everywhere. Motion: GSAP stagger entries, hover scale 1.02 + glow.

**Pages**

- **Home** (`/`) — three.js distorted icosahedron hero + transmission glass shell + radial vignette, StatusPill, animated stat tiles from `/api/stats`, branch tiles, popular-topic chips, top-9 subjects grid.
- **Search** (`/search`) — filters (subject, query debounced 300 ms, unit, marks, year range), result cards, empty/loading/no-match/error states, Framer Motion stagger. Inits from `useSearchParams`.
- **Insights** (`/insights`, `/insights/[subject]`) — subject grid by branch; per-subject Recharts vertical BarChart (violet→cyan) + inline SVG word cloud. Click a bar/term → `/search?q=<term>&subject=<code>`.

**Conventions**

- Same-origin fetches — no CORS.
- Stale-flag pattern (`let active = true`), not AbortController (avoids StrictMode canceled rows).
- `useSearchParams()` pages wrapped in `<Suspense>`.
- Next 15+ async params: `params: Promise<{subject:string}>`, unwrap with `use(params)`.
- Cell-level click handlers, not Bar (Recharts type-safety).
- Pin `tailwindcss@^3.4` (v4 needs different PostCSS config).

## 10. Acceptance Criteria

1. ☐ **≥30 PDFs** scraped into `data/raw/` (§10.1).
2. ☐ Parser hits **≥80%** extraction rate per paper on real CS-502 PDFs.
3. ☐ Supabase has `papers` ≥30, `questions` ≥500, `subject_frequencies` ≥100 rows; RLS OFF.
4. ☐ All 8 `/api/*` routes respond; `/api/health` → `{"status":"ok"}`, `/api/stats` returns real counts.
5. ☐ Frontend: hero blob renders, stats count up, search debounced, frequency chart loads <2 s, Lighthouse mobile perf ≥85.
6. ☐ Deployed live on Vercel; all four browser smoke checks pass on the public URL.

## 11. Security & Secrets

- `SUPABASE_SERVICE_ROLE_KEY` is **server-only**. Never in a client component or `NEXT_PUBLIC_*`.
- `web/lib/supabase.ts` first line: `import "server-only";` (accidental client import = build-time error).
- `.env.local`, `node_modules/`, raw PDFs, and `*.db`/`*.sqlite` are gitignored — never committed.
- Vercel env vars set across Production + Preview + Development.

## 12. Risk Log

| Risk | Mitigation |
|------|-----------|
| Wrong URL shape wastes scrape time | Inspect site first; PDFs at `/be/<slug>.pdf` |
| Scanned (image) PDFs yield no text | rapidocr OCR fallback at 200 DPI |
| Hindi garble misclassified as English | Token-level garble filter |
| 3D perf on low-end devices | Logo-size blob (fov 38, z 5), dpr capped [1,2] |
| GSAP / hydration mismatch | Client components, mount NavBar in layout |
| Supabase free-tier row caps | Top-20 terms per subject; batched writes |
| Leaked service-role key | server-only import, never `NEXT_PUBLIC_*` |
| Vercel function timeout on huge result sets | `limit` on search; precomputed frequencies |
| react-wordcloud unmaintained (React 18/19) | 30-line inline SVG-text cloud |
| Stale `.next/` after Next major upgrade | `rm -rf web/.next` before build |

## 13. Deploy & Operations

- **Stack:** Next.js 16 (App Router, Turbopack, TS) + React 19 + Tailwind v3 + GSAP + three.js + Framer Motion + Recharts; Supabase Postgres; Vercel.
- **Vercel root = `web/`** (not repo root). Framework preset auto-detects Next.js.
- **Code change:** push → Vercel auto-deploys.
- **Data refresh:** locally `python -m src.scraper --all && python -m src.load && python -m src.upload_supabase` → Supabase updated, web reads live (no redeploy).
- **Automation (later):** GitHub Actions weekly cron running the same Python pipeline with Supabase secrets in repo settings.

## 14. After the Workshop

- Expand branch/semester coverage beyond the initial CSE/IT/EC/ME sem 3–8 set.
- Improve parser iteration loop for low-rate papers.
- Add automated weekly ingest via GitHub Actions cron.
- Consider answer/solution linking, user bookmarks, and per-unit analytics as future work.
- Keep robots.txt deviation documented; revisit volume/politeness if scaled up.
