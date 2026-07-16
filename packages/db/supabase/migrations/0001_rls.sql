-- Row-Level Security: children can only ever touch their own family's data.
-- (Implementation Plan, Week 2)

alter table "Parent"       enable row level security;
alter table "ChildProfile" enable row level security;
alter table "Story"        enable row level security;
alter table "StoryPage"    enable row level security;
alter table "Coloring"     enable row level security;
alter table "AuditLog"     enable row level security;

-- Helper: the Parent row belonging to the authenticated Supabase user.
create or replace function current_parent_id() returns uuid
language sql stable security definer as $$
  select id from "Parent" where "authUserId" = auth.uid()
$$;

-- Parents see and edit only themselves.
create policy parent_self on "Parent"
  for all using ("authUserId" = auth.uid());

-- Child profiles: full access for the owning parent only.
create policy child_by_parent on "ChildProfile"
  for all using ("parentId" = current_parent_id());

-- Stories: reachable only through an owned child profile.
create policy story_by_family on "Story"
  for all using (
    "childId" in (select id from "ChildProfile" where "parentId" = current_parent_id())
  );

create policy page_by_family on "StoryPage"
  for all using (
    "storyId" in (
      select s.id from "Story" s
      join "ChildProfile" c on c.id = s."childId"
      where c."parentId" = current_parent_id()
    )
  );

create policy coloring_by_family on "Coloring"
  for all using (
    "pageId" in (
      select p.id from "StoryPage" p
      join "Story" s on s.id = p."storyId"
      join "ChildProfile" c on c.id = s."childId"
      where c."parentId" = current_parent_id()
    )
  );

-- Audit logs: parents may read their own; only the service role writes.
create policy audit_read_own on "AuditLog"
  for select using ("parentId" = current_parent_id());

-- Storage bucket policy reminder (run in dashboard or storage migration):
-- bucket "story-assets": authenticated read scoped by path prefix parentId/,
-- writes by service role only (generation pipeline).
