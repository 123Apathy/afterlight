-- ✅ APPLIED to the live database on 2026-07-27. Kept for the record and so
--    any future Supabase project gets the same posture. Re-running it is a
--    no-op (there are no permissive policies left to drop).
--
-- ── WHAT UNBLOCKED IT ────────────────────────────────────────────────────────
--   The blocker was never production. Prod already had
--   SUPABASE_SERVICE_ROLE_KEY on Netlify (context "all", functions+runtime),
--   and the deployed bundle reads that name. LOCAL DEV was the blocker:
--   server/.env held only the anon key, so the lockdown would have killed
--   localhost on the first read. Deon added SUPABASE_SERVICE_ROLE_KEY to
--   server/.env on 2026-07-27, the local server was restarted onto it, and
--   then this ran.
--
--   Corroborating history: afterlight_members was created 2026-07-26T17:53Z
--   with RLS on and NO policies; local dev hit "new row violates row-level
--   security policy" twice at 18:05Z; an anon ALL policy was added at 18:07Z
--   purely to unbreak it. Prod had no members code until the 07-27 deploy, so
--   those denials were local, not production. That table is now locked too.
--
-- ── VERIFIED AFTER APPLYING (all measured, not assumed) ──────────────────────
--   App still works:
--     prod  GET /api/projects/:id            200
--     prod  GET /api/projects/:id/photos     200, byte-identical to baseline
--     prod  signed photo fetch               200, 116002 bytes (identical)
--     prod  POST /api/projects/:id/members   200
--     local GET project + photos             200
--     local POST /api/photos/:id/favorite    201, row created (then deleted)
--     browser: 7 photos rendered from signed URLs, naturalWidth non-zero
--   Anon (publishable key) is genuinely locked out:
--     GET  /rest/v1/afterlight_{projects,photos,comments,tribute_responses,
--          members}          -> 200 []          (RLS filters every row)
--     POST /rest/v1/afterlight_{projects,comments,members}
--                            -> 401 "new row violates row-level security policy"
--     GET  /storage/v1/object/afterlight-photos/<path> (unsigned)
--                            -> 400 "Object not found"
--     POST /storage/v1/object/list/afterlight-photos   -> 200 []
--   Client data intact: Brenda 40 photos/31 favourites/19 comments/2 members,
--   Mary 191/27/19/3.
--
--   ROLLBACK: server/emergency/afterlight-rls-lockdown-ROLLBACK.sql restores
--   the exact pre-lockdown policies. Only use it to stop an outage.
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
