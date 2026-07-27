-- EMERGENCY ROLLBACK for afterlight-rls-lockdown.sql
--
-- ⚠️ THIS FILE LIVES OUTSIDE server/migrations/ ON PURPOSE. Moved 2026-07-27.
--    It used to sit alongside the real migrations, where any "apply every .sql
--    in migrations/" loop (a script, a new dev, an agent) would have run it and
--    silently re-opened anon read AND write on all 11 tables plus the photo
--    bucket. It is not a migration. It is a fire extinguisher. Run it only by
--    hand, deliberately, to stop a live outage.
--
-- Captured from pg_policies on 2026-07-27, immediately before the lockdown was
-- applied. These are the EXACT policies that existed, reproduced verbatim:
-- 11 public tables on `anon / ALL / using(true) with check(true)`, plus the 3
-- storage policies scoped to the afterlight-photos bucket.
--
-- Run this whole file if the live app breaks after the lockdown. It restores
-- the pre-lockdown state exactly. It is safe to run twice: each statement will
-- error with "policy already exists" if the policy is already back, which does
-- no harm.
--
-- ⚠️ Restoring these re-opens the database to anyone holding the publishable
-- key. Use it to stop an outage, then diagnose, then lock down again.

create policy afterlight_card_notes_anon_all on public.afterlight_card_notes
  for all to anon using (true) with check (true);
create policy afterlight_comment_reactions_anon_all on public.afterlight_comment_reactions
  for all to anon using (true) with check (true);
create policy afterlight_comments_anon_all on public.afterlight_comments
  for all to anon using (true) with check (true);
create policy afterlight_kanban_cards_anon_all on public.afterlight_kanban_cards
  for all to anon using (true) with check (true);
create policy afterlight_kanban_columns_anon_all on public.afterlight_kanban_columns
  for all to anon using (true) with check (true);
create policy afterlight_members_anon_all on public.afterlight_members
  for all to anon using (true) with check (true);
create policy afterlight_photos_anon_all on public.afterlight_photos
  for all to anon using (true) with check (true);
create policy afterlight_projects_anon_all on public.afterlight_projects
  for all to anon using (true) with check (true);
create policy afterlight_ratings_anon_all on public.afterlight_ratings
  for all to anon using (true) with check (true);
create policy afterlight_settings_anon_all on public.afterlight_settings
  for all to anon using (true) with check (true);
create policy afterlight_tribute_responses_anon_all on public.afterlight_tribute_responses
  for all to anon using (true) with check (true);

create policy afterlight_photos_storage_read on storage.objects
  for select to anon, authenticated using (bucket_id = 'afterlight-photos');
create policy afterlight_photos_storage_write on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'afterlight-photos');
create policy afterlight_photos_storage_delete on storage.objects
  for delete to anon, authenticated using (bucket_id = 'afterlight-photos');
