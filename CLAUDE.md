# CLAUDE.md

## Project

RGPV Exam Insights — search individual RGPV B.Tech exam questions across years with frequency analysis. Read [SPEC.md](SPEC.md) for full spec.

## Stack (fixed, do not change)

- Python 3.10+
- PyMuPDF (`fitz`) for PDF extraction
- SQLite + FTS5 for storage/search
- FastAPI backend + Next.js 16 (App Router, TypeScript, Tailwind, Turbopack) + React 19
- GSAP + Three.js (react-three-fiber) for hero animations
- Framer Motion for micro-interactions
- Deploy: backend on Render, frontend on Vercel

## UI Theme (non-negotiable)

- Dark elegant glassmorphism. Bg: `#0A0A0F`. Surface: `#12121A` with backdrop-blur.
- Accent gradient: `#7C5CFF` → `#00D4FF` (violet → cyan).
- Secondary accent: `#FF6B9D` (rose) for highlights.
- Text: `#F5F5FA` primary, `#9CA3AF` secondary.
- Font: "Instrument Serif" for display headings, "Inter" for body, "JetBrains Mono" for code/marks.
- Hero: 3D animated blob (Three.js metaball / distorted icosahedron) with violet→cyan gradient material, GSAP scroll-trigger reveal.
- Cards: glass surface, 1px border `rgba(255,255,255,0.08)`, subtle inner glow on hover.
- Motion: every section enters with GSAP stagger. Hover = scale 1.02 + glow.
- `rounded-2xl` everywhere. Generous whitespace.

## Before Marking Any Task Complete

1. Run `pytest` if backend changed.
2. Run `npm run build` if frontend changed.
3. Open affected page in browser, execute user flow from [SPEC.md](SPEC.md).
4. Screenshot result and report what you saw.

## Discipline

- Always show a plan BEFORE writing code. Wait for approval.
- Small diffs. One concern per commit.
- Never invent question samples — only parse real PDFs.
- Log parser failures, never crash.
- Reference [SPEC.md](SPEC.md) acceptance criteria in every PR description.
