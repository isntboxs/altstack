# API server

Hono on Bun serves Better Auth, typed oRPC, and the OpenAPI reference. Start from
the [root setup](../../README.md#run-locally), then run from the repository root:

```sh
vp run dev:server
```

The local API uses port 3009 from `PORT`. Routes are mounted in
[src/index.ts](src/index.ts); read operations use HTTP `QUERY`.

```sh
curl --request QUERY http://localhost:3009/api/reference/health
vp run --filter 'server...' build
```

The build emits `dist/index.mjs` and the GitHub refresh/review notification job
entrypoints. Jobs need separate schedules and server runtime configuration.
See [architecture](../../docs/architecture.md),
[configuration](../../docs/development.md#configuration), and
[deployment/workers](../../docs/deployment.md#scheduled-workers).
