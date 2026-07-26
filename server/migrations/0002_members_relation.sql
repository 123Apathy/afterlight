-- APPLIED to production (kgzgpanbnpdyamhtjhau) on 2026-07-27 via the Supabase
-- MCP as migration `afterlight_members_relation`.
--
-- Optional relation-to-the-person declared at the name gate (Friend, Spouse,
-- Cousin, free text via Other). Additive; null = not declared.
alter table public.afterlight_members add column if not exists relation text;
