# Deploying Afterlight

Afterlight runs as **one Node process**: the Express server (`server/index.js`)
serves the API *and* the compiled web app (`dist/`) on a single origin.

## Live deploy — Google Cloud Run (current)

Afterlight is deployed as its own Cloud Run service in the same project as PL@4M
(`hosting-and-sharing-platform`, region `europe-west1`), isolated from the other
services. The `Dockerfile` builds the web export and runs the server; Cloud Run
provides HTTPS and scales to zero.

**Redeploy after changes** (needs `gcloud` authed on the project):

```bash
gcloud run deploy afterlight \
  --source . \
  --project hosting-and-sharing-platform \
  --region europe-west1 \
  --allow-unauthenticated \
  --min-instances=0 --max-instances=2 \
  --set-env-vars "^##^SUPABASE_URL=https://kgzgpanbnpdyamhtjhau.supabase.co##SUPABASE_KEY=<publishable key>"
```

Notes:
- **Node 22+ is required** — `@supabase/supabase-js` needs native WebSocket
  (the `Dockerfile` uses `node:22-slim`).
- The `.dockerignore` excludes `.env`, so the web build resolves the API from
  its own origin (never hardcodes localhost). Do not add build ARGs that set
  `EXPO_PUBLIC_API_BASE`.
- Cloud Run injects `PORT` and the `SUPABASE_*` env vars; the server reads them
  from `process.env`.
- Cloud Run caps request bodies at ~32 MB — a single bulk upload of many large
  photos could hit that. Chunk uploads if it becomes an issue.

**Custom domain (optional):** map e.g. `afterlight.pl4m.co.za` with
`gcloud beta run domain-mappings create --service afterlight --domain <domain>
--region europe-west1`, then add the DNS records it prints. The `*.run.app` URL
works fully without this.

## Alternative — a plain VPS

One Node process behind nginx + certbot. Prereqs: Node 22+, nginx, certbot, a
subdomain. Steps: clone the private repo, `npm install` (root + `server/`),
create `server/.env` with `SUPABASE_URL` + `SUPABASE_KEY` + `PORT`, build with
`npx expo export --platform web` (no root `.env` so the API resolves to origin),
run under pm2 (`pm2 start "node --env-file=server/.env server/index.js" --name
afterlight`), reverse-proxy the subdomain to the port, and `certbot --nginx -d
<subdomain>` for HTTPS.

## Notes

- The offline **demo mode** (`EXPO_PUBLIC_DEMO=1`) is for local previews only.
- RLS on the shared Supabase project is still open (server uses the publishable
  key). Lock it down with the secret key when moving to Afterlight's own project.
