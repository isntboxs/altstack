# Elysia with Bun runtime

## Getting Started

Install the workspace dependencies:

```bash
vp install
```

Start the server in development mode from the repository root:

```bash
vp run dev:server
```

## Development

The server runs with watch mode and restarts on file changes.

Open http://localhost:<port>/ with your browser to see the result. The port comes from the `PORT` environment variable (see `.env.example`) and can be overridden.

## Review notification worker

The build includes `dist/jobs/review-notifications.mjs`. Run it every minute in
the server container from `/app`, separately from the daily GitHub job:

```sh
bun run apps/server/dist/jobs/review-notifications.mjs
```

See [migration, server-only config, retry limits and operator recovery](../../docs/review-notifications.md).
