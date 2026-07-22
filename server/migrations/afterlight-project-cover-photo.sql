-- Applied to the current (shared PL@4M) Supabase project on 2026-07-22 as
-- migration `afterlight_project_cover_photo`. Kept here for the future
-- own-project move.
--
-- The photo shown in link previews (WhatsApp/Facebook OG image) when a
-- family member shares the /join/:code invite link. Admin-settable; falls
-- back to the generic brand share image when unset.
ALTER TABLE afterlight_projects ADD COLUMN IF NOT EXISTS cover_photo_id uuid REFERENCES afterlight_photos(id) ON DELETE SET NULL;
