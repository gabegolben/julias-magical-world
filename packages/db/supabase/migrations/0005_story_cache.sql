-- Shared story/illustration cache + optional child gender.
-- Run after 0004_art_and_limits.sql in the Supabase SQL editor.

-- Optional boy/girl on saved stories (mirrors the client field).
alter table public.stories add column if not exists child_gender text;

-- Reusable, name-independent generations. A row is one story (text + art
-- URLs) for a given combination of dimensions EXCEPT the child's name, which
-- is stored as the token {{name}} and swapped per request. Because names are
-- templatized out, rows carry no PII and are safe to share across users; the
-- illustrations (public bucket URLs) are name-independent too.
create table if not exists public.story_cache (
  cache_key text primary key,
  title text not null,
  pages jsonb not null,          -- [{ "text": string, "artUrl": string | null }]
  hits int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.story_cache enable row level security;

-- Any signed-in user may READ the shared cache. There is deliberately NO
-- insert/update/delete policy: writes happen ONLY server-side via the service
-- role (which bypasses RLS), so a client JWT can never poison the shared,
-- re-served children's content. If SUPABASE_SERVICE_ROLE_KEY is unset in the
-- server env, the cache simply never fills (generation still works).
drop policy if exists story_cache_read on public.story_cache;
create policy story_cache_read on public.story_cache
  for select to authenticated using (true);
