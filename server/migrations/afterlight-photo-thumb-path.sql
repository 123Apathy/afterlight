-- Applied to the current (shared PL@4M) Supabase project on 2026-07-22 as
-- migration `afterlight_photo_thumb_path`. Kept here for the future
-- own-project move.
--
-- Small display thumbnail generated client-side at upload; null for photos
-- uploaded before this existed (clients fall back to the full image).
ALTER TABLE afterlight_photos ADD COLUMN IF NOT EXISTS thumb_path text;
