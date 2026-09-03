# syntax=docker/dockerfile:1
#
# Altstack dashboard client (TanStack Start + Nitro → Node).
#
# Dokploy settings for this app:
#   Build Context: / (repo root — required so `workspace:*` deps resolve)
#   Dockerfile:    apps/dashboard/Dockerfile
#   Port:          3000 (Nitro default; honors the PORT env var)
#   Domain:        https://admin.domain.com
#
# VITE_* below are BUILD ARGS — they are baked into the client bundle at
# build time, so changing them in Dokploy requires a rebuild.

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

# Public env — baked into the bundle. Verified: the dashboard build needs ONLY
# these (no server secrets required at build time).
ARG VITE_APP_NAME
ARG VITE_APP_URL
ARG VITE_DASHBOARD_URL
ARG VITE_SERVER_URL
ENV VITE_APP_NAME=${VITE_APP_NAME} \
	VITE_APP_URL=${VITE_APP_URL} \
	VITE_DASHBOARD_URL=${VITE_DASHBOARD_URL} \
	VITE_SERVER_URL=${VITE_SERVER_URL}

# Build dashboard plus its workspace dependencies in topological order.
# NOTE: the `...` filter suffix (package + its dependencies) is required —
# plain `vp run dashboard#build` skips dependency builds.
COPY --chown=vp:vp . .
RUN vp run --filter 'dashboard...' build

# Keep the Node.js binary selected by Vite+ for the final runtime image.
RUN cp "$(vp env which node | head -1)" /tmp/node

# --- production dependencies only ---
# Nitro's `node-server` output keeps some imports external (e.g. `react`),
# resolving them from a surrounding `node_modules` — so the runtime stage
# needs the prod dependency tree next to `.output`.
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
# See apps/server/Dockerfile for why `--ignore-scripts` is set. `--linker`
# hoisted is forwarded to Bun after `--` (`vp install` has no `--linker`
# flag) so the runtime stage can copy a single top-level `node_modules`.
RUN vp install --frozen-lockfile --prod --ignore-scripts -- --linker hoisted

# --- runtime stage: Nitro `node-server` output + prod `node_modules` ---
FROM debian:bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /tmp/node /usr/local/bin/node
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/dashboard/.output ./.output

USER nobody
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
