# ──────────────────────────────────────────────────────────────────────────────
# Y-app — eigen productie-image (Express serveert API + gebouwde frontend).
# Vervangt de node:slim-runner met bind-mounts: de build zit IN de image; alleen
# /data (SQLite + master-key) en de SSO-config zijn nog mounts.
#
#   docker build -t openaec/y-app:git .
#   docker run -p 8098:8098 -v y-data:/data \
#     -v /pad/naar/y-app.json:/openaec/y-app.json:ro openaec/y-app:git
# ──────────────────────────────────────────────────────────────────────────────
FROM node:24-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/frontend/package.json packages/frontend/
COPY packages/server/package.json packages/server/
# better-sqlite3 compileert hier (native) — daarom python3/make/g++ hierboven.
RUN npm ci || npm install --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:24-bookworm-slim
ENV NODE_ENV=production \
    PORT=8098 \
    ERPNEXT_LEVEL_DIST=/app/packages/frontend/dist \
    ERPNEXT_LEVEL_CONFIG_DIR=/data
WORKDIR /app
# Volledige workspace mee (tsx-entrypoint + native modules in node_modules).
COPY --from=build /app /app
VOLUME ["/data"]
EXPOSE 8098
CMD ["npm", "run", "start:server"]
