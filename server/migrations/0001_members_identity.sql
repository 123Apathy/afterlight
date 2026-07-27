-- APPLIED to production (kgzgpanbnpdyamhtjhau) on 2026-07-26 via the Supabase
-- MCP as migrations `afterlight_members_identity` + `afterlight_members_anon_policy`.
-- Kept here for repo visibility; Supabase's migration history is canonical.
--
-- Everlit passwordless identity: durable members behind the existing
-- name-based UX. Additive only: new table + nullable member_id columns +
-- name-keyed backfill. Nothing dropped, nothing rewritten.

create table if not exists public.afterlight_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.afterlight_projects(id) on delete cascade,
  display_name text not null,
  role text not null default 'member' check (role in ('owner','member')),
  -- "Where should we send the film?" -- free-form email or WhatsApp number.
  contact text,
  -- Secret carried by "keep your place" links; unguessable, revocable by
  -- regenerating. Doubles as the owner-claim handoff at create time.
  transfer_token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create unique index if not exists afterlight_members_project_name_key
  on public.afterlight_members (project_id, lower(display_name));

alter table public.afterlight_members enable row level security;

-- HISTORICAL, DELIBERATELY REMOVED on 2026-07-27. This migration used to create:
--   create policy afterlight_members_anon_all on public.afterlight_members
--     for all to anon using (true) with check (true);
-- which matched the pre-lockdown posture (anon ALL, authorisation enforced in
-- Express). afterlight-rls-lockdown.sql has since dropped every such policy, so
-- re-running this file as written would have silently re-opened anon read AND
-- write on the members table, undoing the lockdown without any error.
-- RLS stays enabled with NO policies: deny-all for anon, service-role bypasses.
-- Do not add a policy back here.

alter table public.afterlight_ratings
  add column if not exists member_id uuid references public.afterlight_members(id) on delete set null;
alter table public.afterlight_comments
  add column if not exists member_id uuid references public.afterlight_members(id) on delete set null;
alter table public.afterlight_comment_reactions
  add column if not exists member_id uuid references public.afterlight_members(id) on delete set null;
alter table public.afterlight_tribute_responses
  add column if not exists member_id uuid references public.afterlight_members(id) on delete set null;

-- Backfill: one member per distinct (project, case-insensitive name) seen in
-- any historic contribution, then link every historic row to its member.
insert into public.afterlight_members (project_id, display_name)
select distinct on (project_id, lower(nm)) project_id, nm from (
  select ph.project_id, r.rater as nm
    from public.afterlight_ratings r join public.afterlight_photos ph on ph.id = r.photo_id
  union all
  select ph.project_id, c.author
    from public.afterlight_comments c join public.afterlight_photos ph on ph.id = c.photo_id
  union all
  select ph.project_id, cr.rater
    from public.afterlight_comment_reactions cr
    join public.afterlight_comments c on c.id = cr.comment_id
    join public.afterlight_photos ph on ph.id = c.photo_id
  union all
  select tr.project_id, tr.respondent
    from public.afterlight_tribute_responses tr
) src
where nm is not null and btrim(nm) <> ''
on conflict (project_id, lower(display_name)) do nothing;

update public.afterlight_ratings r set member_id = m.id
from public.afterlight_photos ph, public.afterlight_members m
where r.member_id is null and ph.id = r.photo_id
  and m.project_id = ph.project_id and lower(m.display_name) = lower(r.rater);

update public.afterlight_comments c set member_id = m.id
from public.afterlight_photos ph, public.afterlight_members m
where c.member_id is null and ph.id = c.photo_id
  and m.project_id = ph.project_id and lower(m.display_name) = lower(c.author);

update public.afterlight_comment_reactions cr set member_id = m.id
from public.afterlight_comments c, public.afterlight_photos ph, public.afterlight_members m
where cr.member_id is null and c.id = cr.comment_id and ph.id = c.photo_id
  and m.project_id = ph.project_id and lower(m.display_name) = lower(cr.rater);

update public.afterlight_tribute_responses tr set member_id = m.id
from public.afterlight_members m
where tr.member_id is null
  and m.project_id = tr.project_id and lower(m.display_name) = lower(tr.respondent);
