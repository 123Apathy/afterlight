-- Already applied to the current (shared PL@4M) Supabase project on
-- 2026-07-22 as migration `afterlight_reaction_unique_toggle`. Kept here so
-- any future database (e.g. Everlit's own Supabase project at the planned
-- move-out) gets the same rule — the reaction-toggle endpoint in
-- server/app.js depends on this constraint existing to stay atomic.
--
-- One reaction per (comment, rater, emoji): makes the tap-to-toggle atomic
-- and prevents duplicate reaction rows under concurrent taps.
ALTER TABLE afterlight_comment_reactions
  ADD CONSTRAINT afterlight_comment_reactions_unique_toggle
  UNIQUE (comment_id, rater, emoji);
