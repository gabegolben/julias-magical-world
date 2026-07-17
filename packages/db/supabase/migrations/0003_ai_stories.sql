-- AI-generated stories carry their own text (template stories leave these
-- null and derive text from locale files). Run after 0002_demo_sync.sql.

alter table public.stories add column if not exists title text;
alter table public.stories add column if not exists pages jsonb;
