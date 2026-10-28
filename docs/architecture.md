# Architecture

AltStack is a TypeScript workspace with a server-rendered web app, a separate
API, and scheduled workers. PostgreSQL stores catalogue and private workflow
data; Redis provides shared intake quotas; object storage holds media.

## Request flow

1. The browser reaches `apps/web`, built with React, TanStack Start/Router/Query,
   and Nitro. File routes live in [src/routes](../apps/web/src/routes), while
   feature queries and UI live in [src/features](../apps/web/src/features).
2. Web requests use the typed oRPC API. SSR forwards session cookies to the API
   and propagates refreshed cookies back to the browser. Cookie scope therefore
   matters for separate hosts; see [origins and cookies](development.md#origins-and-cookies).
3. [apps/server/src/index.ts](../apps/server/src/index.ts) mounts Hono middleware,
   Better Auth, RPC, and the generated OpenAPI interface on Bun.
4. API procedures validate inputs, derive the caller from the session, enforce
   permissions, and execute queries/transactions through Drizzle.
5. Scheduled server CLIs refresh GitHub snapshots and deliver committed review
   notifications. The request server does not start their schedules.

## Package boundaries

| Package  | Responsibility and entry points                                                                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `api`    | [Contracts](../packages/api/src/contracts), [routers](../packages/api/src/routers), [queries](../packages/api/src/queries), provider adapters, and outbox delivery |
| `auth`   | [Server policy](../packages/auth/src/server/config.ts), sessions, OAuth, Magic Links, account access, and claim email delivery                                     |
| `db`     | [Schema exports](../packages/db/src/schemas.ts), relations, migrations, transactional file imports, and disposable test schemas                                    |
| `env`    | Server-only configuration and public web build configuration                                                                                                       |
| `shared` | [Schemas](../packages/shared/src/schemas), constants, repository normalization, license and star comparison helpers                                                |
| `ui`     | Interactive components, styles, and isolated [email templates](../packages/ui/src/emails)                                                                          |

Keep auth-server, database, storage credentials, email sending, and native image
decoding out of browser imports. Email components accept data and render HTML/text;
they do not load environment variables or call providers.

## API surfaces

| Prefix           | Purpose                                                |
| ---------------- | ------------------------------------------------------ |
| `/api/auth/*`    | Better Auth sign-in, callbacks, sessions, and sign-out |
| `/api/rpc/*`     | Typed oRPC procedures used by the web app              |
| `/api/reference` | API reference and explicitly mapped HTTP operations    |

Contracts define paths, methods, detailed input sections, and output validation.
Read operations use HTTP **`QUERY`**, including the health operation; do not assume
`GET`. Confirm proxy/CORS support for this method. For example:

```sh
curl --request QUERY http://localhost:3009/api/reference/health
```

RPC-only compatibility operations are omitted from OpenAPI. Authentication uses
cookies, and private operations independently enforce permissions on the server.
See [contracts/index.ts](../packages/api/src/contracts/index.ts) and
[handler.ts](../packages/api/src/handler.ts) for the authoritative mappings.

## Data and consistency

- `projects` owns listing identity, content, visibility, and submission provenance.
  `github_repositories` and `github_star_history` hold observed repository data.
- Category hierarchy/path history and project assignments support canonical URLs
  and stable redirects. Tags reflect GitHub topics with separate admin curation.
- Bookmarks, reports, claims, memberships, upload grants, and auth records are
  separate private models. Submission provenance does not grant membership.
- `audit_log` records supported lifecycle/access actions. The admin activity feed
  returns an explicit safe projection rather than raw metadata.
- `submission_review_notifications` is a durable private outbox tied to committed
  moderation events. Notification creation and the decision commit together.

Transactions and shared locks protect taxonomy changes, draft capacity,
repository identity conflicts, membership decisions, and last-admin availability.
Revision checks reject stale edits. External GitHub/storage calls run outside
long write transactions; authoritative conditions are checked again before commit.
The import CLI shares the category integrity lock with API writers.

## Public rendering and media

Public reads select published records and explicit public fields. Private feedback,
report contacts, claim evidence, and auth data do not enter public projections.
Session-aware SSR HTML is private/no-store. Route guards help navigation; they
do not replace API authorization.

Markdown rendering supports GFM, project mentions, and server-prepared highlighted
code. README import normalizes repository-relative links and drops unsupported
unsafe markup. Storage uploads start as temporary objects and are validated and
promoted before final keys are persisted; member grants bind uploads to account
and project.

The [SEO feature](../apps/web/src/features/seo) builds canonical URLs from public
configuration, serves sitemap/robots routes, and renders social images with local
fonts/artwork. Dynamic images and badges check current public visibility and use
no-store responses. Social platforms may cache their own copies.

## Changing a feature

Trace the shared schema → contract → authorized router/query → web consumer →
targeted tests. Include migrations for persistence changes and update the relevant
guide. For runtime configuration or worker changes, also update
[configuration](development.md#configuration) and [deployment](deployment.md).
