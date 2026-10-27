# AltStack

A curated directory for discovering and evaluating open-source software.
Browse projects by category, GitHub topic, and license; inspect repository
activity; save a shortlist; and submit projects for review.

## Features

- Searchable catalogue with hierarchical categories, tags, license filters,
  sorting, and observed GitHub star history.
- Project pages with Markdown documentation, media, link previews, shareable
  SVG badges, and admin-curated featured projects.
- GitHub and email Magic Link sign-in, private bookmarks, submission tracking,
  rejection feedback, and resubmission.
- Project representative verification, scoped owner/maintainer editing, and
  membership management.
- Admin workspace for moderation, reports, taxonomy, users, recorded activity,
  and operational observations.

These describe the current source. Deployment and provider configuration are
managed separately. See the [PRD](docs/prd.md#functional-requirements) for feature
behavior and permissions, and the [roadmap](docs/roadmap.md) for planned work.

## Run locally

You need Node.js **22.18 or newer**, [Vite+](https://viteplus.dev), and Docker
with Compose. Vite+ provisions the Bun version pinned in `package.json`.

From the repository root:

```sh
vp install
cp .env.example .env
```

Fill in your own development credentials using the
[configuration section](docs/development.md#configuration). The API requires PostgreSQL,
GitHub OAuth, Upstash Redis REST, and S3-compatible storage configuration.
Resend enables email sign-in, project verification emails, and review emails.
The example file contains local defaults and placeholders; it does not connect
to a shared service or provide working provider credentials.

```sh
vp run db:start
vp run db:migrate
vp run --filter @altstack/db db:validate-audit-actions
vp run dev
```

Open [the web app](http://localhost:3010). The API listens on
`http://localhost:3009`. The database starts empty; to populate it, follow the
[CSV/JSON import section](docs/development.md#data-import).

For troubleshooting, targeted tests, and editor setup, see
[development](docs/development.md). For container builds, scheduled workers,
and recovery, see [deployment](docs/deployment.md).

## Repository layout

| Path              | Purpose                                                         |
| ----------------- | --------------------------------------------------------------- |
| `apps/web`        | React, TanStack Start/Router/Query, Tailwind CSS, and Nitro SSR |
| `apps/server`     | Hono API on Bun and scheduled job entrypoints                   |
| `packages/api`    | oRPC contracts, authorization, queries, and integrations        |
| `packages/auth`   | Better Auth configuration and email authentication              |
| `packages/db`     | Drizzle schema, migrations, imports, and test database tools    |
| `packages/env`    | Validated server and public web configuration                   |
| `packages/shared` | Shared validation, types, and utilities                         |
| `packages/ui`     | Shared components, styles, and React Email templates            |
| `packages/config` | Shared tool configuration                                       |
| `data`            | Synthetic CSV/JSON import templates                             |
| `docs`            | Contributor, product, and self-hosting guides                   |

## Documentation and contributing

The five guides below cover local development, the implementation, operations,
and product direction:

| Guide                                | Contents                                                              |
| ------------------------------------ | --------------------------------------------------------------------- |
| [Development](docs/development.md)   | Local setup, configuration, testing, troubleshooting, and data import |
| [Architecture](docs/architecture.md) | Package responsibilities, request/data flow, and integrations         |
| [Deployment](docs/deployment.md)     | Builds, migrations, scheduled workers, monitoring, and recovery       |
| [Product requirements](docs/prd.md)  | User needs, feature behavior, permissions, and scope                  |
| [Roadmap](docs/roadmap.md)           | Implemented scope, priorities, and conditional future work            |

See [CONTRIBUTING.md](CONTRIBUTING.md) for bug reports, pull requests, and scoped
validation, [SECURITY.md](SECURITY.md) for vulnerability reporting, and
[CHANGELOG.md](CHANGELOG.md) for notable changes.

All deployment examples use localhost or reserved example domains. Keep real
environment files, credentials, deployment identifiers, and production records
outside public documentation.

## License

A repository license has not been selected yet. No project license is declared.
Bundled third-party resources retain their own license notices, including the
[Inter font license](apps/web/src/features/seo/og/assets/Inter-OFL.txt).
