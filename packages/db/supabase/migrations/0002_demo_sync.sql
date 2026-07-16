-- Demo-phase cloud sync (static build, client-side supabase-js + RLS).
-- One parent account owns the device library; child profiles arrive with
-- the full Prisma schema (0001_rls.sql) when the server phase lands.
-- Run this in the Supabase SQL editor.

create table if not exists public.stories (
  id uuid primary key,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  character_key text not null,
  setting_key text not null,
  child_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.colorings (
  story_id uuid not null references public.stories (id) on delete cascade,
  page int not null,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ops jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (story_id, page)
);

alter table public.stories enable row level security;
alter table public.colorings enable row level security;

drop policy if exists stories_owner on public.stories;
create policy stories_owner on public.stories
  for all using (owner = auth.uid()) with check (owner = auth.uid());

drop policy if exists colorings_owner on public.colorings;
create policy colorings_owner on public.colorings
  for all using (owner = auth.uid()) with check (owner = auth.uid());
