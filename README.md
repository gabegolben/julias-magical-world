# Julia's Magical World 🦄

AI-powered storytelling + coloring platform for children ages 3–14.
See `julias-magical-world-project-v1.2.md` (overview) and
`julias-magical-world-implementation-plan.md` (build plan).

## Repo layout

```
apps/web              Next.js app (App Router, next-intl, Tailwind, PWA-ready)
packages/magic-fill   Coloring engine: scanline flood fill + gap-closing masks
packages/ai           Story pipeline: zod schemas, prompts, safety, Inngest jobs
packages/db           Prisma schema + Supabase RLS migration
```

## Quick start

```bash
npm install                       # workspace install
npm test                          # magic-fill suite (8 tests, no deps needed)
npm run dev                       # http://localhost:3000 — no keys needed
```

The current build is a **fully client-side demo** of the Julia loop:
template-based stories (EN/PT-BR/ES), procedurally generated SVG coloring
pages, magic fill, read-aloud via the Web Speech API, and a localStorage
library. It ships as a static export to GitHub Pages on every push to
`main` (`.github/workflows/deploy.yml`).

**Optional cloud accounts (parent area):** create a Supabase project, set
`NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (locally in
`apps/web/.env.local`, on CI as GitHub Actions variables), and run
`packages/db/supabase/migrations/0002_demo_sync.sql` in the Supabase SQL
editor. Without them the app runs fully local — the parent area just says
cloud accounts are off.

The full Prisma schema (`packages/db/prisma`, `0001_rls.sql`) belongs to the
upcoming server phase (AI pipeline, child profiles):

```bash
npx prisma migrate dev -w @jmw/db # apply schema (server phase)
# then run packages/db/supabase/migrations/0001_rls.sql in Supabase SQL editor
```

The magic-fill tests run with **zero dependencies**:

```bash
cd packages/magic-fill && npm test
```

## Status vs. implementation plan

| Plan item | Status |
|---|---|
| Week 1 — monorepo, Next.js, i18n (EN/PT-BR/ES), Tailwind tokens, CI | ✅ scaffolded |
| Week 2 — Prisma schema, RLS policies, COPPA-safe data model | ✅ written |
| Week 3 — AI pipeline (schemas, prompts, safety layers, Inngest jobs) | ✅ skeleton; **model bake-off pending** — provider adapters throw until pinned |
| Week 3 — magic-fill prototype (Risk #1) | ✅ **implemented + 8/8 tests passing**, incl. leak rollback, gap closing, tap-nudge, 1024² perf |
| Week 4 — Magic Mode UI shell | ✅ StoryBuilder, OptionCard, ColoringCanvas, home page |
| Weeks 5–6 — story creation flow, progress screen, story reader, read-aloud | ✅ **demo mode**: template stories + procedural SVG line art, no AI keys needed |
| Weeks 5–6 — optional name insertion (parent-entered) | ✅ child becomes the protagonist (text in all 3 languages + child figure in the art) |
| Week 10 — library with save/load | ✅ localStorage op-log persistence |
| Week 10 — PDF export / "fridge mode" | ✅ print view (`/story/print?id=` colored, `?character=&setting=` blank coloring pages) |
| Public shareable build | ✅ static export → GitHub Pages on every push to `main` |
| PWA manifest + offline | ✅ manifest + minimal service worker (Serwist when app moves server-side) |
| Week 2 — Supabase Auth flow | ✅ parent signup/login + email verification ("email plus" consent) + cloud library sync via RLS |
| Week 3 — real AI pipeline wiring (model bake-off) | ⬜ demo uses templates until models are pinned |

## The magic-fill engine (why it matters)

The plan's #1 technical risk: AI line art with gaps leaks flood fills across
the whole page. The engine solves it three ways, all covered by tests:

1. **Gap-closing masks** — the line art is dilated into a *fill-only* boundary
   mask (visible art untouched), sealing gaps up to ~2× the dilation radius.
2. **Leak detection + rollback** — fills that reach the canvas border or
   exceed 60% coverage are rolled back byte-for-byte.
3. **Tap nudging** — taps on outlines snap to the nearest *enclosed* region,
   trialing distinct regions so kids who tap the line still color the shape.

Performance: full 1024×1024 fill in <100ms — comfortably tablet-friendly.

## Key decisions encoded in this repo

- **No free-text input for ages 3–5** — story requests are zod enums; the
  injection surface for Magic Mode is zero by construction.
- **Fail-closed safety** — unparseable LLM output retries; flagged text goes
  to human review (`AuditLog.flagged`), never to a child.
- **Op-log coloring persistence** — fills are stored as tiny replayable ops
  (`Coloring.canvasOps`), which gives us undo, auto-save, and thumbnails for free.
- **i18n from commit #1** — every UI string lives in `apps/web/messages/`
  in all three Day-1 languages.
