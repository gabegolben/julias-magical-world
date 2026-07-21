-- Reusable child profiles so parents don't re-enter a child's details each
-- time. Private per parent (name/appearance is PII) — RLS owner-only, like
-- stories. Run after 0007_profiles.sql in the Supabase SQL editor.

create table if not exists public.children (
  id uuid primary key,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  gender text,
  traits text,               -- premium free-text appearance/personality
  created_at timestamptz not null default now()
);

alter table public.children enable row level security;

drop policy if exists children_owner on public.children;
create policy children_owner on public.children
  for all using (owner = auth.uid()) with check (owner = auth.uid());
