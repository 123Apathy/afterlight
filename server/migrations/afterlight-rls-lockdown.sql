-- ⚠️ DO NOT APPLY until the server runs on the SECRET (service-role) key.
--
-- ── PREREQUISITE STATUS, verified 2026-07-27 ─────────────────────────────────
--   PRODUCTION: READY. SUPABASE_SERVICE_ROLE_KEY is set on Netlify at context
--     "all" with the functions+runtime scopes, and the deployed function bundle
--     reads that exact name (supabaseClient.js lists it first). Prod will keep
--     working after the lockdown.
--   LOCAL DEV: **NOT READY — this is the blocker.** server/.env holds only
--     SUPABASE_KEY (the anon/publishable key). Applying this migration as-is
--     breaks localhost immediately: every read and write from `node
--     server/index.js` starts failing.
--     Proof it behaves exactly that way: afterlight_members was created on
--     2026-07-26T17:53Z with RLS on and NO policies. Local dev hit
--     "new row violates row-level security policy for table
--     afterlight_members" twice at 18:05Z, and an anon ALL policy was added at
--     18:07Z purely to unbreak it. Prod did not carry the members code until
--     the 2026-07-27 deploy, so those denials were local, not production.
--   TO UNBLOCK: add SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) to
--     server/.env, restart the local server, confirm it reads and writes, then
--     apply. Keep the ability to smoke-test a live endpoint immediately after.
--   ROLLBACK, if the live app breaks (one statement per table, e.g.):
--     create policy afterlight_members_anon_all on public.afterlight_members
--       for all to anon using (true) with check (true);
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Order of operations (breaking either step's order kills the live app):
--   1. In the Supabase dashboard: Project Settings → API → copy the secret key.
--   2. Set SUPABASE_SECRET_KEY in server/.env (local) and the Netlify env
--      (production). server/supabaseClient.js already prefers it when present.
--   3. Verify the server boots and reads/writes fine on the secret key.
--   4. THEN apply this migration. It removes all anon/authenticated access to
--      the afterlight_* tables and the photos bucket, so the public
--      publishable key (which ships in every browser bundle) can no longer
--      read or write anything directly — everything must flow through the
--      Express API, which enforces invite-code write auth.
--
-- The service-role key bypasses RLS entirely, so no explicit service policies
-- are needed: dropping the permissive policies IS the lockdown.

-- Tables: drop every existing permissive policy, leave RLS enabled with no
-- policies (= deny all for anon/authenticated; service-role bypasses RLS).
DO $$
DECLARE
  t text;
  pol record;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename LIKE 'afterlight_%'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, t);
    END LOOP;
  END LOOP;
END $$;

-- Storage: remove any permissive policies scoped to the afterlight bucket.
-- (Signed URLs and signed upload URLs are minted by the service-role server
-- and do not depend on storage RLS policies.)
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (qual LIKE '%afterlight-photos%' OR with_check LIKE '%afterlight-photos%')
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- Post-apply smoke test (run as anon via the REST endpoint — must ALL fail):
--   curl 'https://<project>.supabase.co/rest/v1/afterlight_projects?select=*' \
--     -H 'apikey: <publishable key>'          → expects []/permission denied
-- And the app itself (through the API) must still work end-to-end.
