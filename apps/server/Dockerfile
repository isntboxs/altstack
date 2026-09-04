# syntax=docker/dockerfile:1
#
# Altstack API server (Hono + Bun).
#
# Dokploy settings for this app:
#   Build Context: / (repo root — required so `workspace:*` deps resolve)
#   Dockerfile:    apps/server/Dockerfile
#   Port:          3009
#   Domain:        https://api.domain.com
#
# Runtime env (set in Dokploy, NOT baked into the image):
#   NODE_ENV, PORT, DATABASE_URL, APP_NAME, BETTER_AUTH_URL,
#   BETTER_AUTH_SECRET, CORS_ORIGINS, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
#
# DB migrations are NOT run here — run once against the external Postgres:
#   DATABASE_URL=<prod-url> bun run --filter @altstack/db db:migrate

# --- build stage: Vite+ provisions the pinned Bun package manager ---
FROM ghcr.io/voidzero-dev/vite-plus:latest AS build
WORKDIR /app

# Workspace manifests first so `vp install` stays cached across source changes.
COPY --chown=vp:vp package.json bun.lock ./
COPY --chown=vp:vp apps/server/package.json apps/server/package.json
COPY --chown=vp:vp apps/web/package.json apps/web/package.json
COPY --chown=vp:vp apps/dashboard/package.json apps/dashboard/package.json
COPY --chown=vp:vp packages/api/package.json packages/api/package.json
COPY --chown=vp:vp packages/auth/package.json packages/auth/package.json
COPY --chown=vp:vp packages/config/package.json packages/config/package.json
COPY --chown=vp:vp packages/db/package.json packages/db/package.json
COPY --chown=vp:vp packages/env/package.json packages/env/package.json
COPY --chown=vp:vp packages/shared/package.json packages/shared/package.json
COPY --chown=vp:vp packages/ui/package.json packages/ui/package.json
# NOTE: `--ignore-scripts` skips the root `prepare` script (`vp config`, which
# only wires local git hooks and is meaningless in Docker). Verified that no
# other workspace lifecycle script exists.
RUN vp install --frozen-lockfile --ignore-scripts

# Build the server plus its workspace dependencies in topological order
# (env → shared → db → auth → api → server).
# NOTE: plain `vp run server#build` does NOT build dependencies — the
# `...` filter suffix (package + its dependencies) is required.
COPY --chown=vp:vp . .
RUN vp run --filter 'server...' build
# Drop workspace-level `node_modules` (isolated-layout symlinks into the build
# stage's own store). The runtime stage uses the hoisted prod `node_modules`
# from the `deps` stage instead — leaving these here would create dangling
# symlinks in the final image.
RUN rm -rf apps/*/node_modules packages/*/node_modules

# --- production dependencies only (devDependencies, incl. the toolchain, pruned) ---
FROM ghcr.io/voidzero-dev/vite-plus:latest AS deps
WORKDIR /app
COPY --chown=vp:vp package.json bun.lock ./
COPY --chown=vp:vp apps/server/package.json apps/server/package.json
COPY --chown=vp:vp apps/web/package.json apps/web/package.json
COPY --chown=vp:vp apps/dashboard/package.json apps/dashboard/package.json
COPY --chown=vp:vp packages/api/package.json packages/api/package.json
COPY --chown=vp:vp packages/auth/package.json packages/auth/package.json
COPY --chown=vp:vp packages/config/package.json packages/config/package.json
COPY --chown=vp:vp packages/db/package.json packages/db/package.json
COPY --chown=vp:vp packages/env/package.json packages/env/package.json
COPY --chown=vp:vp packages/shared/package.json packages/shared/package.json
COPY --chown=vp:vp packages/ui/package.json packages/ui/package.json
# Bun 1.4 defaults to isolated installs (per-workspace `node_modules` plus a
# `.bun` store). `--linker hoisted` flattens everything into the single
# top-level `node_modules` below, so the runtime stage can copy just one dir.
# NOTE: `vp install` has no `--linker` flag — it is forwarded to Bun after
# `--` (see `vp install --help`).
RUN vp install --frozen-lockfile --prod --ignore-scripts -- --linker hoisted

# --- runtime stage ---
FROM oven/bun:1.4.1-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3009

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/package.json /app/bun.lock /app/tsconfig.json ./
COPY --from=build /app/apps/server/package.json /app/apps/server/tsconfig.json ./apps/server/
COPY --from=build /app/apps/server/dist ./apps/server/dist
# Workspace sources: package `exports` maps resolve to `src/*.ts`,
# which Bun executes directly — so `src` (not just `dist`) must ship.
COPY --from=build /app/packages ./packages

USER nobody
EXPOSE 3009
CMD ["bun", "apps/server/dist/index.mjs"]
