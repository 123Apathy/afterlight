# Deploying Afterlight to a VPS

Afterlight runs as **one Node process**: the Express server (`server/index.js`)
serves the API *and* the compiled web app (`dist/`) on a single origin. Put it
behind nginx with HTTPS and it's live.

## Prerequisites on the VPS

- **Node 20.6+** (the server uses `--env-file`), `npm`, `git`
- **nginx** + **certbot** (Let's Encrypt) for HTTPS — required, because the
  invite-link copy and the photo picker only work on a secure origin
- A **subdomain** with an A record pointing at the VPS IP (e.g. `afterlight.yourdomain.co.za`)

## 1. Get the code

The repo is private (`github.com/123Apathy/afterlight`). Give the VPS read
access once — easiest is `gh auth login` on the box, or add a read-only deploy
key, or clone over HTTPS with a personal access token.

```bash
git clone https://github.com/123Apathy/afterlight.git
cd afterlight
npm install
cd server && npm install && cd ..
```

## 2. Server env

Copy your local `server/.env` values onto the VPS (they are NOT in the repo):

```bash
cat > server/.env <<'EOF'
SUPABASE_URL=<your supabase url>
SUPABASE_KEY=<publishable key for now>
PORT=4400
EOF
```

> Keep the root `.env` absent on the VPS. If `EXPO_PUBLIC_API_BASE` is set at
> build time it hardcodes that URL into the client and breaks in production.
> With no root `.env`, the client correctly calls its own origin.

## 3. Build the web app

```bash
npx expo export --platform web   # produces ./dist, served by the Express server
```

## 4. Run it (pm2)

```bash
npm i -g pm2
pm2 start "node --env-file=server/.env server/index.js" --name afterlight
pm2 save && pm2 startup   # keep it running across reboots
```

Health check: `curl localhost:4400/health` → `{"ok":true}`.

## 5. nginx + HTTPS

```nginx
# /etc/nginx/sites-available/afterlight
server {
  server_name afterlight.yourdomain.co.za;
  client_max_body_size 40m;            # photo uploads
  location / {
    proxy_pass http://127.0.0.1:4400;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

```bash
ln -s /etc/nginx/sites-available/afterlight /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d afterlight.yourdomain.co.za   # issues + wires up HTTPS
```

Visit `https://afterlight.yourdomain.co.za` — create a memorial, upload a
photo, favourite it. Invite links will automatically use this domain.

## Updating later

```bash
git pull
npm install
npx expo export --platform web
pm2 restart afterlight
```

## Notes

- The offline **demo mode** (`EXPO_PUBLIC_DEMO=1`) is for local previews only —
  leave it off in production.
- RLS on the shared Supabase project is still open (server uses the publishable
  key). Switch to the secret key + lock down policies when moving to Afterlight's
  own Supabase project.
