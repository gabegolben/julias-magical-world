-- AI illustrations + per-user daily rate limits. Run after 0003_ai_stories.sql
-- in the Supabase SQL editor.

-- 1. Usage ledger: one row per AI generation, counted by /api/generate to
--    enforce daily caps (STORY_DAILY_LIMIT / IMAGE_DAILY_LIMIT env vars).
--    Insert/select only — no update/delete policies, so a user can never
--    shrink their own count; the ledger only grows.
create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('story', 'image')),
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_owner_time on public.ai_usage (owner, created_at desc);

alter table public.ai_usage enable row level security;

drop policy if exists ai_usage_insert on public.ai_usage;
create policy ai_usage_insert on public.ai_usage
  for insert with check (owner = auth.uid());

drop policy if exists ai_usage_select on public.ai_usage;
create policy ai_usage_select on public.ai_usage
  for select using (owner = auth.uid());

-- 2. Per-page AI art URLs on stories (array aligned with pages; null entry =
--    procedural client-side art for that page).
alter table public.stories add column if not exists page_art jsonb;

-- 3. Public bucket for generated line art. Public read is deliberate: images
--    are generic coloring pages (never PII), paths are unguessable uuids, and
--    both domains (Vercel + GitHub Pages) plus the print view need plain <img>
--    access. Authenticated users can add objects; nobody can overwrite or
--    delete (no update/delete policies).
insert into storage.buckets (id, name, public)
values ('story-art', 'story-art', true)
on conflict (id) do nothing;

drop policy if exists story_art_insert on storage.objects;
create policy story_art_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'story-art');

drop policy if exists story_art_read on storage.objects;
create policy story_art_read on storage.objects
  for select using (bucket_id = 'story-art');
