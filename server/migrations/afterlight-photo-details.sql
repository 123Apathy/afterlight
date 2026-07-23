-- Applied to the current (shared PL@4M) Supabase project as migration
-- `afterlight_photo_details`. Kept here for the future own-project move.
--
-- Per-photo details a family member can add: when the photo was taken (free
-- text -- "1998", "June 1998", or a full date -- because most people only
-- remember the year) and where. Both nullable; older photos simply have none.
-- photo_date is text on purpose so "even if it's just the year" works without
-- forcing a valid calendar date, and it's still enough to sort roughly
-- chronologically later.
ALTER TABLE afterlight_photos ADD COLUMN IF NOT EXISTS photo_date text;
ALTER TABLE afterlight_photos ADD COLUMN IF NOT EXISTS location text;
