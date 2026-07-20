-- Parent profiles: the server-side source of truth for the premium tier.
-- Run after 0006_story_cache_variants.sql in the Supabase SQL editor.
--
-- Users can READ their own row; there are deliberately NO insert/update/delete
-- policies, so plan changes happen only server-side (service role) — a client
-- JWT can never upgrade itself. A missing row means the free tier.
-- When billing lands, its webhook writes this table.

create table if not exists public.profiles (
  owner uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'premium')),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists profiles_read_own on public.profiles;
create policy profiles_read_own on public.profiles
  for select using (owner = auth.uid());

-- To upgrade an account manually (SQL editor runs as service role):
--
--   insert into public.profiles (owner, plan)
--   select id, 'premium' from auth.users where email = 'parent@example.com'
--   on conflict (owner) do update set plan = 'premium', updated_at = now();
--
-- Downgrade: same with 'free'.
