# Deploying Everlit

## Live deploy: Netlify, via a local build

Everlit is hosted on **Netlify** (site `afterlight-memorial`, domain
`everlit.co.za`). The web app is a static export served by Netlify's CDN, and
the API runs as a Netlify Function (`netlify/functions/api.js`) that wraps the
same Express app used in local dev via `serverless-http`.

**The deploy method is one script, and only that script:**

```
Deploy Everlit.cmd        (Desktop -> Launch Scripts)
```

It runs `scripts/deploy-everlit.ps1`, which commits anything outstanding,
builds locally with `npx expo export --platform web`, and uploads with
`netlify deploy --prod`. Building locally is the point: it never spends a
server-side Netlify build credit. First run needs a one-time browser login.

**Before every deploy, check `.env` has no `EXPO_PUBLIC_DEMO=1` line.** It is
baked into the local build, so leaving it in ships demo mode to production.

**Pushing does NOT deploy. Corrected 2026-07-27.** This section used to warn that
a `git push` could trigger a real deploy. It cannot. `netlify.toml` sets
`ignore = "exit 0"`, which makes Netlify skip the build on every git-triggered
attempt, so no push has ever published anything. That matters in the opposite
direction to the old warning: **never assume a fix is live because you pushed
it.** Nothing reaches production except a local `netlify deploy --prod` (the
`Deploy Everlit.cmd` script), which ignores that setting. Standing rule stays:
commit locally, and only push or deploy when Deon explicitly asks.

### Emergency deploy from another machine

The usual path needs one Windows desktop. If it is unavailable and a security fix
has to ship, from any machine with Node 22+:

```
git clone https://github.com/123Apathy/afterlight.git && cd afterlight
git checkout netlify-migration
npm ci && npm --prefix server ci
npx netlify login          # one-time browser auth
npx expo export --platform web
npx netlify deploy --prod --dir dist
```

Check `.env` has no `EXPO_PUBLIC_DEMO=1` and no dev API base before exporting.
The Netlify env already holds `SUPABASE_SERVICE_ROLE_KEY` and `ADMIN_SECRET`, so
nothing secret needs to exist on the temporary machine.

## Google Cloud Run: gone, do not use

Everlit **used to** run on Cloud Run at
`afterlight-609359716289.europe-west1.run.app`. **That service was deleted on
2026-07-22.** If you find a `gcloud run deploy afterlight ...` command, a
`*.run.app` URL, or a claim that Cloud Run is current anywhere in the docs or
the vault, it is stale and should be corrected. The `Dockerfile` is kept only
because the VPS path below can still use it.

## Alternative: a plain VPS

Not in use, kept as a fallback. One Node process behind nginx + certbot.
Prereqs: Node 22+, nginx, certbot, a subdomain. Clone the repo (note: it is
currently PUBLIC at `github.com/123Apathy/afterlight`, not private),
`npm install` (root + `server/`), create `server/.env` with `SUPABASE_URL`,
`SUPABASE_KEY`, `PORT` and `ADMIN_SECRET`, build with
`npx expo export --platform web` (with no root `.env`, so the API resolves to
its own origin), run under pm2
(`pm2 start "node --env-file=server/.env server/index.js" --name everlit`),
reverse-proxy the subdomain to the port, then `certbot --nginx -d <subdomain>`.

**Node 22+ is required**: `@supabase/supabase-js` needs native WebSocket.

## Running it locally

Two processes:

- **API + static, port 4400**: `npm run server`
  (`node --env-file=server/.env server/index.js`). Serves the landing page,
  the admin dashboard and the API.
- **Metro web, port 8081**: `npx expo start --web`. Serves the app itself.

Two things that will fool you:

1. **Express serves `dist/`, not `public/`.** `dist/` is a build artifact, so
   `localhost:4400/` can show a landing page far older than your working tree.
   Refresh it for review with `cp -r public/. dist/` (static files only; the
   app bundle in `dist/_expo` still needs a real export).
2. **Metro bakes `EXPO_PUBLIC_DEMO` at process start.** A Metro instance
   started while that line was in `.env` keeps serving demo mode even after
   the line is removed. Restart Metro to clear it.

**Admin dashboard:** `/admin/<ADMIN_SECRET>`, secret in `server/.env`. The
route 404s if the env var is unset or the path does not match.

## Notes

- Demo mode (`EXPO_PUBLIC_DEMO=1`) is for local previews only, never prod.
- Supabase is still on PL@4M's shared project (`kgzgpanbnpdyamhtjhau`);
  migrating Everlit to its own project is still outstanding.
- RLS policies are still `USING(true)` for anon. The prerequisite is met (the
  server prefers `SUPABASE_SERVICE_ROLE_KEY`, which is set on Netlify prod) and
  the lockdown migration is written at
  `server/migrations/afterlight-rls-lockdown.sql`, but it has **not** been
  applied. Before applying it, confirm the currently deployed commit actually
  contains the service-role preference, or the migration will lock out a live
  site running older code.
- Cloud Run's ~32MB request cap no longer applies. Netlify Functions have their
  own payload limit, which has not been tested against bulk photo uploads.
