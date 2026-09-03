# syntax=docker/dockerfile:1
#
# Altstack web client (TanStack Start + Nitro → Node).
#
# Dokploy settings for this app:
#   Build Context: / (repo root — required so `workspace:*` deps resolve)
#   Dockerfile:    apps/web/Dockerfile
#   Port:          3000 (Nitro default; honors the PORT env var)
#   Domain:        https://app.domain.com
#
# VITE_* below are BUILD ARGS — they are baked into the client bundle at
# build time, so changing them in Dokploy requires a rebuild.

# --- build stage ---
FROM oven/bun:1.4 AS build
WORKDIR /app

# Workspace manifests first so `bun install` stays cached across source changes.
COPY package.json bun.lock ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY packages/api/package.json packages/api/package.json
COPY packages/auth/package.json packages/auth/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/env/package.json packages/env/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/ui/package.json packages/ui/package.json
# NOTE: `--ignore-scripts` skips the root `prepare` script (`vp config`, which
# only wires local git hooks and is meaningless in Docker). Verified that no
# other workspace lifecycle script exists.
RUN bun install --frozen-lockfile --ignore-scripts

# Public env — baked into the bundle. Verified: the web build needs ONLY
# these (no server secrets required at build time).
ARG VITE_APP_NAME
ARG VITE_APP_URL
ARG VITE_DASHBOARD_URL
ARG VITE_SERVER_URL
ENV VITE_APP_NAME=${VITE_APP_NAME} \
	VITE_APP_URL=${VITE_APP_URL} \
	VITE_DASHBOARD_URL=${VITE_DASHBOARD_URL} \
	VITE_SERVER_URL=${VITE_SERVER_URL}

# Build web plus its workspace dependencies in topological order.
# NOTE: the `...` filter suffix (package + its dependencies) is required —
# plain `vp run web#build` skips dependency builds.
COPY . .
RUN ./node_modules/.bin/vp run --filter 'web...' build

# --- production dependencies only ---
# Nitro's `node-server` output keeps some imports external (e.g. `react`),
# resolving them from a surrounding `node_modules` — so the runtime stage
# needs the prod dependency tree next to `.output`.
FROM oven/bun:1.4-slim AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY packages/api/package.json packages/api/package.json
COPY packages/auth/package.json packages/auth/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/env/package.json packages/env/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/ui/package.json packages/ui/package.json
# See apps/server/Dockerfile for why `--ignore-scripts` / `--linker` are set.
RUN bun install --frozen-lockfile --production --ignore-scripts --linker hoisted

# --- runtime stage: Nitro `node-server` output + prod `node_modules` ---
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/web/.output ./.output

USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
