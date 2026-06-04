# RGPV Exam Insights

> Search every individual RGPV B.Tech exam question across years with frequency analysis.

Workshop project for Patel College of Science & Technology (PCST), Indore — agentic coding with Claude Code. See [SPEC.md](SPEC.md) for the full specification, [PLAN.md](PLAN.md) for the implementation plan, [CLAUDE.md](CLAUDE.md) for the build rules, and [BUILD_GUIDE.md](BUILD_GUIDE.md) for the step-by-step prompts.

## Features

- Scrapes 8 years of B.Tech papers across **CSE / IT / EC / ME** from rgpvonline.com (98 subjects, ~280 PDFs).
- Extracts text with PyMuPDF; **OCR fallback** (rapidocr-onnxruntime) for scanned 2022+ papers.
- State-machine parser breaks each paper into individual questions with `unit / question_number / marks / text`.
- SQLite + **FTS5** index — sub-second keyword search with OR-semantics on multi-word queries.
- FastAPI backend: `/stats`, `/branches`, `/subjects`, `/search`, `/frequency`, `/question/{id}`, `/random`.
- Next.js 16 (App Router, Turbopack, React 19) + Tailwind frontend.
- **Hero**: Three.js distorted icosahedron + transmission halo, GSAP-animated stat counters.
- Per-subject frequency view (Recharts bar chart + inline SVG word cloud) — click any term to filter search.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Language | Python 3.10+ (ingest only), TypeScript 5 |
| PDF | PyMuPDF + rapidocr-onnxruntime OCR fallback |
| DB | **Supabase Postgres** (tsvector FTS, RLS disabled) |
| API | **Next.js 16 Route Handlers** (`app/api/*`) |
| Frontend | Next.js 16, Tailwind v3, GSAP, three.js / @react-three/fiber, Framer Motion, Recharts |
| Deploy | **Vercel** (frontend + API in one deploy) |

## Project Structure

```
patel_workshop/
├── data/raw/<subject>/<year>-<SESSION>.pdf
├── src/{scraper,extractor,parser,db,load,search,app,upload_supabase}.py
├── tests/                # 35 backend tests (parser/db/search/api smoke)
├── supabase/schema.sql   # Postgres tables + FTS + RLS-off
├── web/                  # Next.js 16 (frontend + /api/* route handlers)
│   ├── app/api/          # Next API routes — Supabase queries
│   └── lib/supabase.ts   # server-only client (service-role key)
├── SPEC.md PLAN.md CLAUDE.md BUILD_GUIDE.md DEPLOY.md
└── requirements.txt
```

## Prerequisites

- Python ≥ 3.10
- Node ≥ 20 (for `web/`)
- ~1 GB free disk for PDFs + SQLite

## Setup

### Ingest (one-time, local)

```bash
pip install -r requirements.txt
python -m src.scraper --all               # ~10 min, ~280 PDFs into data/raw/
python -m src.load                        # ~20–30 min (OCR on scanned pages) → data/exam.db
# push to Supabase
NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... python -m src.upload_supabase
```

Apply schema once in Supabase SQL editor from [supabase/schema.sql](supabase/schema.sql).

### Web app

```bash
cd web
npm install
cp .env.example .env.local                # paste NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
npm run dev
```

Open <http://localhost:3000>. API routes live at `/api/*`, served by the same Next.js process.

## Environment Variables

| Var | Where | Purpose |
|-----|-------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | web + uploader | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | web + uploader | Server-only key, bypasses RLS (do not expose to client) |
| `RGPV_DB_PATH` | uploader | Local SQLite path, defaults to `data/exam.db` |

## Data Ingestion

```bash
python -m src.scraper --subject CS-502         # one subject
python -m src.scraper --all --year-from 2018   # full corpus
python -m src.load                             # extract → parse → SQLite
```

Both commands are idempotent: re-running skips already-downloaded files and replaces parsed questions per paper.

## Testing

```bash
pytest -v        # backend (35 tests)
cd web && npm run build   # frontend type-check + production build
```

## Deployment

See [DEPLOY.md](DEPLOY.md) for Render + Vercel walkthrough.

## Acceptance Criteria (SPEC §10)

- [x] ≥ 30 PDFs ingested (280 scraped)
- [x] ≥ 80% questions correctly parsed (CS-502 spot-check: 15/15, 16/16, 14/14)
- [x] Search works on keyword + ≥ 2 filters (subject, unit, marks, year range)
- [x] Frequency view shows top 10+ repeated terms per subject
- [ ] App deployed at public URL (follow [DEPLOY.md](DEPLOY.md))
- [x] README documents local run

## Notes

- `robots.txt` on rgpvonline.com disallows non-Google bots. Workshop-scale, low-volume use with custom UA + 0.4 s sleep. For larger scrapes, ship the pre-zipped corpus instead.
- Many 2022+ RGPV papers are scanned images. OCR fallback handles them at ~10 s/page — full first-time load takes 20–30 min.
- Bilingual Hindi blocks in source PDFs are filtered via an english-character ratio heuristic; remaining garbled glyphs are scrubbed in `search._clean_text`.
