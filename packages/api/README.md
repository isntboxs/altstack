# API package

This package owns typed oRPC contracts, authorized procedures, database queries,
GitHub/storage integrations, intake quotas, and review notification delivery.
The Hono server mounts it; this package is not a standalone HTTP service.

| Directory/file                   | Purpose                                                        |
| -------------------------------- | -------------------------------------------------------------- |
| [src/contracts](src/contracts)   | HTTP/RPC contracts and shared input/output schemas             |
| [src/routers](src/routers)       | Procedure implementations and authorization                    |
| [src/queries](src/queries)       | Reusable database reads and integrity helpers                  |
| [src/handler.ts](src/handler.ts) | RPC/OpenAPI handlers and generated reference                   |
| [tests](tests)                   | Contract, authorization, workflow, and integration regressions |

Read operations use `QUERY`, not `GET`; HTTP operation inputs retain their
`params`, `query`, and `body` sections. Only explicitly mapped contracts appear
in OpenAPI. See [architecture](../../docs/architecture.md#api-surfaces).

From the repository root, run affected database-backed tests through the wrapper:

```sh
vp run db:test:start
vp run --filter @altstack/db test:scoped -- vp run --filter @altstack/api test run tests/bookmark.test.ts
```

Use [development](../../docs/development.md#targeted-verification) for validation
scope and the [PRD](../../docs/prd.md) for privacy, lifecycle, and permission
rules. Provider acceptance and deployment schedules are separate from unit tests.
