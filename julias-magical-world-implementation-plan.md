# Julia's Magical World — Step-by-Step Implementation Plan

**Companion to:** Project Overview v1.2 | **Timeline:** ~10 months to full launch | **Team assumption:** solo engineer (you), part-time design/legal support

---

## Guiding Principles

1. **Ship the "Julia loop" first.** The core loop (pick character → get story → color it → save it) must work end-to-end before anything else exists. Everything in Phase 0–1 serves that loop.
2. **Compliance is a gate, not a feature.** COPPA/GDPR-K work happens *before* public beta, not after. Community features launch at 13+ only (see Overview §14.1).
3. **i18n from commit #1.** EN/PT/ES are Day-1 languages (Decision #7). Retrofitting i18n is one of the most expensive mistakes in web development — every string goes through next-intl from the start.
4. **PWA-first, native never (until proven).** Per Decision #3, no React Native work until PWA retention/engagement data justifies it.
5. **Re-validate AI model choices at build time.** The doc's model picks (GPT-4o-mini, DALL-E 3) were made mid-2025. Benchmark current models for line-art quality and structured output before locking in.

---

## Phase 0: Foundation (Weeks 1–4)

### Week 1 — Project scaffolding
- [ ] Create GitHub repo (monorepo: `apps/web`, `packages/db`, `packages/ai`)
- [ ] Bootstrap Next.js (latest stable) + TypeScript + Tailwind + shadcn/ui
- [ ] Configure next-intl with `en`, `pt-BR`, `es` locale files; establish the rule: **no hardcoded strings, ever**
- [ ] Set up Vercel project (preview deployments on every PR)
- [ ] Set up Supabase project (dev + prod instances)
- [ ] GitHub Actions: lint, typecheck, Vitest on every push
- [ ] Sentry integration (client + server)

### Week 2 — Data model & auth
- [ ] Design Prisma schema:
  - `Parent` (email, verified_at, locale, subscription_status)
  - `ChildProfile` (display_name, age_band [3-5 | 6-9 | 10-14], avatar, parent_id) — **no PII beyond first name/nickname**
  - `Story` (child_id, title, language, style, status, pages JSONB)
  - `StoryPage` (story_id, page_number, text, line_art_url, coloring_state JSONB)
  - `Coloring` (page_id, canvas_data, updated_at)
  - `Subscription`, `Purchase`, `AuditLog` (all AI interactions)
- [ ] Implement Supabase Auth for parents (email + verification — this doubles as COPPA "email plus" consent)
- [ ] Child profile creation flow (parent-gated; PIN-protected parent area)
- [ ] Row-level security policies in Supabase (children can only touch their own data)

### Week 3 — AI pipeline skeleton
- [ ] **Model bake-off (1–2 days):** test 2–3 current LLMs for structured story JSON and 2–3 image models for coloring-book line art (thick outlines, closed regions, no shading). Score on: closed-region reliability (critical for magic fill), character consistency, cost. Lock choices.
- [ ] Build the generation pipeline as background jobs (Inngest):
  1. `generateStory` — prompt template (age band + language + character + setting) → structured JSON (title, pages[], illustration prompts, palette)
  2. `generateIllustrations` — one job per page, parallel, with retry
  3. `safetyCheck` — text moderation + image moderation (Azure Content Safety) on every output
- [ ] Response caching layer (Upstash Redis) keyed on normalized prompt inputs
- [ ] Prompt-injection hardening: template-only input for ages 3–9 at MVP (no free text = no injection surface)

### Week 4 — UI shell & age modes
- [ ] Age-mode routing: Magic Mode (3–5) layout with icon-only navigation
- [ ] Design tokens for the three age modes (type scale, tap-target sizes, color schemes)
- [ ] Basic library page (grid of story cards)
- [ ] PWA setup (Serwist): manifest, install prompt, offline shell caching

**Milestone / exit criteria:** A parent can sign up, verify email, create a child profile, and see an empty library — in all 3 languages. CI green. Story pipeline generates a valid story JSON + images in a test harness.

---

## Phase 1: MVP — "Julia's First Story" (Weeks 5–12)

### Weeks 5–6 — Story creation flow (ages 3–5)
- [ ] Tap-to-select character screen (5 characters) and setting screen (5 settings)
- [ ] Optional name insertion (parent-entered, first name only)
- [ ] Generation progress screen (fun animation — generation takes 30–90s; make waiting delightful)
- [ ] Story reader: page-by-page view, large text, highlighted read-along (pre-generated TTS audio per page)
- [ ] 5 launch templates: fantasy, animals, space, adventure, fairy tale

### Weeks 7–9 — Coloring engine (the hardest part — budget accordingly)
- [ ] Canvas foundation on Fabric.js (evaluate Konva as fallback if Fabric fights you on flood-fill)
- [ ] **Magic fill:** scanline flood-fill on the raster line art with tolerance threshold. Test heavily against real AI-generated line art — open regions are the #1 failure mode. Add a "gap-closing" morphological pass on line art before fill
- [ ] 8-color chunky palette UI
- [ ] Simple brush tool (one size at MVP)
- [ ] Undo/redo stack
- [ ] Auto-save coloring state (debounced, per page, to Supabase)
- [ ] Completion celebration animation
- [ ] Performance target: smooth on a 3-year-old iPad (test on real low-end hardware)

### Week 10 — Library & PDF export
- [ ] Save/load stories with coloring state
- [ ] PDF export (server-side job: react-pdf or Puppeteer render) — A4 + Letter
- [ ] "Show parent" share button

### Weeks 11–12 — Hardening & Julia beta
- [ ] Safety pass: red-team the story generator with adversarial template combos; verify moderation catches injected weirdness
- [ ] Playwright E2E: signup → create story → color → export
- [ ] Load-test the generation queue (10 concurrent stories)
- [ ] **Beta with Julia + 5–10 friend families.** Watch sessions in person. The 4-year-old usability test will invalidate assumptions — reserve a full week for fixes
- [ ] Privacy policy + ToS drafted (get a COPPA-experienced lawyer to review **before** any non-family user touches it — 2–4 week lead time, start this in Week 8)

**Milestone / exit criteria:** Julia can create, hear, color, and save a story unassisted. Parent can export a PDF. Zero unsafe outputs in 200 generated test stories.

---

## Phase 2: Growth Features (Months 4–5)

### Month 4
- [ ] Adventure Mode (6–9): expanded menus, genre picker, mid-story choices, 8–12 page stories
- [ ] Creator Mode (10–14): free-text prompts — **now injection protection matters**: input classification + structured prompting + output moderation, all three layers live before this ships
- [ ] Remaining two illustration styles (Watercolor Soft, Manga Sketch) — all 4 per Decision #2
- [ ] Brush upgrades: sizes, custom color picker, pattern fills

### Month 5
- [ ] Stripe integration: Free / Creator ($7.99 mo, $59.99 yr) / Legend ($149) tiers; enforce free-tier limits (5 stories/mo, 2 styles, watermarked PDF)
- [ ] Parent dashboard v1: activity view, content controls, screen-time limits, data export & deletion (GDPR-K rights)
- [ ] Mobile/tablet responsiveness pass across all three age modes
- [ ] **Public beta launch** to Julia's Circle → parent communities (marketing §13.1)

**Milestone:** first paying subscriber; conversion funnel instrumented (PostHog or Vercel Analytics + custom events).

---

## Phase 3: Engagement (Months 6–7)

- [ ] Collections, favorites, search in the library
- [ ] First seasonal pack (time it to a real holiday on the calendar)
- [ ] Print Studio: book-formatted PDF (cover, page numbers) → **Lulu sandbox integration** (Decision #4): API auth, print-job creation, webhook status tracking; one end-to-end physical test book
- [ ] Achievements/badges (light touch — creativity, not addiction mechanics)
- [ ] "Color With Me" family mode via Supabase Realtime (same-account only at first; defer friend invites)
- [ ] Voice narration polish: pre-generated ElevenLabs audio in EN/PT/ES, cached aggressively

**Milestone:** full consumer feature set; first physical book printed and in hand.

---

## Phase 4: Scale (Months 8–10)

- [ ] Community gallery — **13+ only**, pre-moderation queue (nothing public without review at this scale)
- [ ] Blurb premium print tier
- [ ] Classroom license MVP: teacher account, 30 profiles, bulk export
- [ ] Stable Diffusion migration trigger check: if >10K stories/month, stand up self-hosted SD + LoRA per style (Decision #5); otherwise defer
- [ ] Phase-2 languages (French, German, Italian) if demand signals support it
- [ ] PWA metrics review → go/no-go decision on native app work

**Milestone:** multiple revenue streams live; unit economics validated against §12.2 targets.

---

## Cross-Cutting Workstreams (run continuously)

| Workstream | Cadence | Notes |
|---|---|---|
| Safety red-teaming | Every release | New feature = new attack surface, especially free-text input |
| Cost monitoring | Weekly | Per-story AI cost dashboard; alert if >$1.00/story average |
| Kid usability testing | Every phase | Real children, real devices, observed sessions |
| Legal review | Phase gates | COPPA at beta; ToS updates at community launch; B2B contracts at Phase 4 |
| Backups & DR | From Week 2 | Supabase PITR enabled; stories are irreplaceable keepsakes — treat them that way |

---

## Top 5 Risks to Watch (build-specific, beyond §16C)

1. **Line-art quality for magic fill.** AI-generated line art with open regions breaks flood-fill. Mitigation: gap-closing preprocessing, quality-scoring gate, template fallback. Prototype this in Week 3 — it's the biggest technical unknown.
2. **Character consistency across pages.** Same character must look the same on page 1 and page 8. Mitigation: seed pinning, reference-image conditioning, LoRA later. Accept "close enough" at MVP.
3. **Generation latency.** 8 pages × image gen can take minutes. Mitigation: progressive delivery (show page 1 while pages 2–8 generate), delightful loading states.
4. **Solo-founder scope creep.** The spec describes ~2 years of work. Defend the phase gates ruthlessly; the MVP is 5 templates, one age band, magic fill, PDF export — nothing more.
5. **COPPA missteps.** One violation can end the project. Lawyer review before public beta is non-negotiable; the 13+ community decision removes the riskiest surface.

---

## Definition of Done — MVP Checklist

- [ ] End-to-end loop works on iPad + Android tablet + desktop, in EN/PT/ES
- [ ] 200-story safety test: zero inappropriate outputs
- [ ] Magic fill success rate >95% on generated line art
- [ ] Time-to-first-story < 2 minutes from tap
- [ ] COPPA-reviewed privacy policy live
- [ ] Julia's verdict: 😍
