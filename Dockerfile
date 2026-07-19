# Afterlight on Cloud Run: one container serving the API + web app.
# Node 22+ required — @supabase/supabase-js needs native WebSocket (absent in 20).
FROM node:22-slim
WORKDIR /app

# Install deps (root + server) with good layer caching.
COPY package.json package-lock.json* ./
RUN npm install
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm install

# App source (see .dockerignore — .env is excluded so the web build resolves
# the API from its own origin instead of hardcoding localhost).
COPY . .

# Build the web export -> ./dist, which server/index.js serves.
RUN npx expo export --platform web

# Cloud Run injects PORT (8080) and the SUPABASE_* env vars; the server reads
# them from process.env, so no --env-file here.
CMD ["node", "server/index.js"]
