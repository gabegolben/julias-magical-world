-- Allow multiple cached variants per combination so the same dimensions can
-- return different stories (picked at random). Run after 0005_story_cache.sql.
--
-- story_cache.cache_key was the primary key (one row per combination); switch
-- to a surrogate id primary key + a plain index on cache_key so several rows
-- can share a key.

alter table public.story_cache drop constraint if exists story_cache_pkey;
alter table public.story_cache add column if not exists id uuid not null default gen_random_uuid();
alter table public.story_cache add constraint story_cache_pkey primary key (id);
create index if not exists story_cache_key_idx on public.story_cache (cache_key);
