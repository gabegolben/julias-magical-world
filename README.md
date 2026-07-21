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

One codebase, two deployments:

- **Vercel (server mode)** — signed-in parents get real AI-generated story
  text via `/api/generate` (Claude Haiku, `STORY_MODEL` env; premium tiers
  via `STORY_MODEL_PREMIUM`); everyone else gets template stories.
- **GitHub Pages (`STATIC_EXPORT=1`)** — the fully client-side free mirror:
  template stories, procedural SVG coloring pages, magic fill, read-aloud,
  localStorage library. Deploys on every push (`.github/workflows/deploy.yml`).

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
| Week 3 — AI pipeline | ✅ providers (Claude stories/review + OpenAI line art), fail-closed safety, mock-tested end-to-end (10 tests); line-art quality gate scores images with the magic-fill engine itself |
| Week 3 — model bake-off | ✅ ran 2026-07-17: all Claude tiers 3/3 valid+safe; all gpt-image models 100% fill-friendly; dall-e-3 retired from the API. Pinned: STORY_MODEL=claude-haiku-4-5 ($0.004/story measured), ILLUSTRATION_MODEL=gpt-image-1-mini |
| AI stories in the app | ✅ `/api/generate` on Vercel (auth-gated; template fallback everywhere else). The Pages mirror calls it cross-origin (CORS) |
| AI illustrations in the app | ✅ per-page line art (gpt-image-1-mini), gated by the magic-fill engine, stored in Supabase Storage (`story-art` bucket); procedural art fills any page that fails the gate or the daily budget |
| Per-user rate limiting | ✅ append-only `ai_usage` ledger, daily story/image caps (`STORY_DAILY_LIMIT` / `IMAGE_DAILY_LIMIT` env) |
| Optional boy/girl | ✅ optional child gender by the name field; refines AI pronouns + the illustrated child |
| Premium tier | ✅ server-derived from `profiles.plan` (server-only writes — a client can't upgrade itself); premium gets `STORY_MODEL_PREMIUM` / `ILLUSTRATION_MODEL_PREMIUM`; cache entries never shared across tiers |
| Premium "about your child" | ✅ optional free text (personality/appearance) enriching story + illustration prompts. The app's only free-text surface, so: premium-only (server-enforced), keyword-screened before spend, prompt-framed as data, output still fail-closed reviewed, personalized stories bypass the shared cache, raw text not persisted |
| Premium story text editing | ✅ premium parents can edit page text + title in the reader (images untouched); edits save to their own story record + cloud row only — never to the shared `story_cache` |
| Child profiles | ✅ save a child's name/gender/(premium) appearance once and pick them on the create screen; private per parent (`children` table, RLS owner-only), local-first with cloud sync; managed in the parent area |
| Shared story/art cache | ✅ `story_cache` reuses prior generations for matching dimensions, swapping the name (`{{name}}` token) — zero AI/image spend on a hit. Keeps up to `STORY_CACHE_VARIANTS` (default 3) stories per combination and serves one at random for variety. Server-only writes via `SUPABASE_SERVICE_ROLE_KEY` (clients read-only, can't poison) |

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
