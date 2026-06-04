# Deploy — Vercel + Supabase

Single-stack deploy: Next.js (frontend + API routes) on Vercel, Postgres on Supabase. No separate backend.

## 1. Supabase

1. Create project at https://supabase.com.
2. Settings → API → copy **Project URL** and **service_role** key.
3. SQL Editor → paste contents of [supabase/schema.sql](supabase/schema.sql) → **Run**. Creates `papers`, `questions`, `subject_frequencies`, plus `subject_stats` and `branch_stats` views. RLS is explicitly disabled on all three tables.
4. (One-time) Local upload:
   ```bash
   pip install -r requirements.txt
   python -m src.scraper --all      # ~10 min, fills data/raw/
   python -m src.load               # ~20 min, fills data/exam.db
   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... python -m src.upload_supabase
   ```

Re-run `upload_supabase` whenever the local corpus grows — it wipes Supabase tables and re-pushes (idempotent).

## 2. Vercel

From `web/`:

```bash
npm i -g vercel
vercel link
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel --prod
```

Project root = `web/`. [web/vercel.json](web/vercel.json) handles framework detection. Frontend + API routes ship in one Vercel deployment.

## 3. Smoke test

```bash
curl https://<app>.vercel.app/api/health
curl https://<app>.vercel.app/api/stats
open https://<app>.vercel.app
```

SPEC §10 end-to-end: search "BCNF" → DBMS hits across years → click into insights → frequency chart loads.
