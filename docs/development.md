# Development

Follow the [root setup](../README.md#run-locally) first. Run commands below from
the repository root unless stated otherwise.

- [Toolchain and commands](#toolchain-and-commands)
- [Configuration](#configuration), including providers, public values, and cookies
- [Local databases](#local-databases)
- [Data import](#data-import)
- [Targeted verification](#targeted-verification) and [browser tests](#browser-tests)
- [Generated assets and editor support](#generated-assets-and-editor-support)
- [Troubleshooting](#troubleshooting)

## Toolchain and commands

Use `vp install` for dependencies and `vp run <name>` for repository scripts and
tasks. Built-ins such as `vp dev` differ from scripts: `vp run dev` starts the
workspace apps and package watchers. Run standalone TypeScript with `vpx`.

| Command                             | Purpose                                                |
| ----------------------------------- | ------------------------------------------------------ |
| `vp run dev`                        | Start all workspace development tasks                  |
| `vp run dev:web`                    | Start only the web development server                  |
| `vp run dev:server`                 | Start only the API in Bun watch mode                   |
| `vp run --filter 'web...' build`    | Build web and its workspace dependencies               |
| `vp run --filter 'server...' build` | Build API/jobs and their dependencies                  |
| `vp run db:studio`                  | Open the database browser for your configured database |
| `vp toolchain`                      | Inspect the active Vite+ toolchain                     |
| `vp env doctor`                     | Diagnose runtime or package-manager setup problems     |

Filtering a build to `web` or `server` alone skips dependency builds; include
`...` when those outputs need to be rebuilt.

## Configuration

Copy [.env.example](../.env.example) to `.env` at the repository root. Its values
are examples; supply credentials for services you control. The API validates
configuration on startup using [server.ts](../packages/env/src/server.ts); public
web values are validated in [web.ts](../packages/env/src/web.ts).

### Server runtime

| Variable                                   | Required              | Purpose                                                                           |
| ------------------------------------------ | --------------------- | --------------------------------------------------------------------------------- |
| `NODE_ENV`                                 | Yes                   | `development`, `test`, or `production`                                            |
| `PORT`                                     | Yes                   | API port; local default `3009`                                                    |
| `DATABASE_URL`                             | Yes                   | Application PostgreSQL connection URL                                             |
| `APP_NAME`                                 | Yes                   | Server application name                                                           |
| `BETTER_AUTH_URL`                          | Yes                   | Canonical API origin, locally `http://localhost:3009`                             |
| `BETTER_AUTH_SECRET`                       | Yes                   | Generate a private random value of at least 32 characters                         |
| `BETTER_AUTH_COOKIE_DOMAIN`                | No                    | Shared parent hostname for trusted sibling hosts; empty locally                   |
| `CORS_ORIGINS`                             | Yes                   | Comma-separated exact web origins; also Better Auth trusted origins               |
| `GITHUB_CLIENT_ID`                         | Yes                   | Your GitHub OAuth app client ID                                                   |
| `GITHUB_CLIENT_SECRET`                     | Yes                   | OAuth secret; current schema requires at least 32 characters                      |
| `GITHUB_TOKEN`                             | For scheduled refresh | Server-only token for public repository metadata; at least 32 characters when set |
| `UPSTASH_REDIS_REST_URL`                   | Yes                   | HTTPS REST endpoint for your development or deployment Redis database             |
| `UPSTASH_REDIS_REST_TOKEN`                 | Yes                   | Redis REST credential for submission/report quotas                                |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`    | Yes                   | Your S3-compatible object storage configuration                                   |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Yes                   | Storage credentials; secret key requires at least 32 characters                   |
| `S3_PUBLIC_URL`                            | Yes                   | Public base URL for published assets                                              |
| `RESEND_API_KEY`                           | For email             | Server-only sending credential                                                    |
| `RESEND_FROM_EMAIL`                        | For email             | Plain address on your verified sender domain, e.g. `notifications@example.com`    |
| `EMAIL_APP_URL`                            | For review worker     | Canonical web origin, also present in `CORS_ORIGINS`; HTTPS in production         |

Generate the auth secret locally with `openssl rand -hex 32` and store the result
only in your private `.env` or secret manager. Empty optional strings are treated
as unset. Required provider configuration is validated even if you are only
working on another API feature; this repository has no bundled provider emulator
or automatic mock mode for the development server.

`TEST_DATABASE_URL` is used by test tooling, separately from runtime validation.
`POSTGRES_PASSWORD` configures the local Compose services. See
[development databases](#local-databases). For scheduled containers,
`TZ=Asia/Jakarta` keeps legacy timestamp handling consistent with the GitHub
history date buckets; schedule timezones must still be configured explicitly.

### Public web build values

| Variable             | Example                   |
| -------------------- | ------------------------- |
| `VITE_APP_NAME`      | `AltStack`                |
| `VITE_APP_URL`       | `http://localhost:3010`   |
| `VITE_SERVER_URL`    | `http://localhost:3009`   |
| `VITE_S3_PUBLIC_URL` | `https://cdn.example.com` |

Every `VITE_*` value is public and embedded at build time. Changing container
runtime environment does not update an already-built web bundle. Keep
`VITE_S3_PUBLIC_URL` aligned with `S3_PUBLIC_URL`; rebuild the web image when a
public URL changes. Never put credentials into a `VITE_*` variable or build arg.

### Provider setup

**GitHub:** create an OAuth app for your own instance. For local development, use
`http://localhost:3010` as the homepage and
`http://localhost:3009/api/auth/callback/github` as the callback. A deployment
example callback is `https://api.example.com/api/auth/callback/github`.
The optional catalogue token is separate from a user's linked OAuth account;
it never proves authority in a project access claim.

**Redis:** configure a dedicated development Upstash database. Submission and
report limits use shared Redis state across API instances; storage failure stops
the operation instead of falling back to an in-memory limit. Ordinary tests mock
provider requests. Live integration tests require explicit development-only
credentials and opt-in; see the
[integration test](../packages/api/tests/submission-rate-limit.integration.test.ts).

**Storage:** configure your S3-compatible endpoint and a public asset base URL.
For an R2 setup, the endpoint shape is
`https://<account-id>.r2.cloudflarestorage.com` and the region is `auto`; the
account identifier is a placeholder. Configure bucket CORS to allow the exact
web origins and upload methods/headers used by
[storage.ts](../packages/api/src/storage.ts). Configure lifecycle cleanup for
temporary `tmp/*` uploads; keep database backups in separate private storage.

**Email:** configure a Resend-verified sender domain and both email credentials.
GitHub-only local sign-in can run without them; email requests return a generic
retryable error until configured. Disable click tracking for authentication
emails. Review decisions require the separate scheduled worker described in
[deployment](deployment.md#scheduled-workers).

### Origins and cookies

Use exact HTTP(S) origins without paths, credentials, queries, fragments, or
wildcards. For localhost, keep the cookie domain empty and use the same hostname
for both ports; mixing `localhost` and `127.0.0.1` breaks cookie sharing.

For a deployment on trusted sibling hosts, this is an example API configuration:

```dotenv
NODE_ENV=production
BETTER_AUTH_URL=https://api.example.com
BETTER_AUTH_COOKIE_DOMAIN=example.com
CORS_ORIGINS=https://app.example.com
EMAIL_APP_URL=https://app.example.com
```

Replace these reserved example domains with your own. A parent-domain cookie is
sent to that parent and all its subdomains, so choose the narrowest shared parent
whose entire scope you trust. Independent, unrelated domains need a different
domain/proxy arrangement for the existing SSR session flow. Keep HTTPS,
HttpOnly cookies, and the existing origin/CSRF protections enabled.

When changing cookie scope, test in a clean browser profile or remove stale
host-only and parent-domain auth cookies. Verify sign-in, hard reload of a private
route, session refresh, and sign-out. The production reverse proxy must overwrite
untrusted forwarded headers and supply one valid client IP; the API origin must
not permit direct header spoofing. Document the actual proxy chain privately.

## Local databases

[docker-compose.yml](../docker-compose.yml) provides separate PostgreSQL 18
services bound to loopback:

| Use         | Database        | Port | Storage                 |
| ----------- | --------------- | ---- | ----------------------- |
| Development | `altstack`      | 5432 | Persistent named volume |
| Tests       | `altstack_test` | 5433 | Disposable tmpfs        |

```sh
vp run db:start
vp run db:migrate
vp run --filter @altstack/db db:validate-audit-actions
```

`db:stop` stops development PostgreSQL; `db:down` removes the container while
preserving its volume. `db:watch` streams database logs. If you change
`POSTGRES_PASSWORD`, update both database URLs. Changing the variable does not
change the password inside an existing volume.

After a schema change, run `vp run db:generate`, inspect the generated migration,
then apply it with `db:migrate`. Preserve the migration history. The separate
audit-action validation command runs after migration commit and is safe to
repeat. Use migrations for shared environments; `db:push` is a local schema
prototyping tool.

## Data import

The file importer adds categories, projects, repository metadata, and assignments
without resetting the database or replacing existing records. Run it from the
repository root with your own `DATABASE_URL` and an already-migrated database.

```sh
vp run db:seed -- --help
vp run db:seed -- --categories ./data/categories.json --projects ./data/projects.json --dry-run
```

Review the plan before removing `--dry-run`. At least one of `--projects` and
`--categories` is required. File paths are relative to the caller's directory;
the root command preserves it. The CLI loads the root `.env` without overriding
existing process variables and closes its database pool on exit.

Templates: [categories.json](../data/categories.json),
[projects.json](../data/projects.json), [categories.csv](../data/categories.csv),
and [projects.csv](../data/projects.csv). They are synthetic draft examples with
unverified repository/media URLs; replace them before a real import. A dry-run
still needs the database to inspect existing records.

### File format

Use a JSON array of objects or CSV with a case-sensitive header. CSV supports
quoted commas/newlines, UTF-8 BOM, CRLF, and blank lines. Unknown/duplicate fields,
inconsistent columns, and invalid values fail validation. Omit optional JSON
fields rather than setting `null`; empty optional CSV cells mean omitted.

| Category field | Rules                                              |
| -------------- | -------------------------------------------------- |
| `name`         | Required, 2–100 trimmed characters                 |
| `slug`         | Required; normalized using application slug rules  |
| `description`  | Required, 1–300 trimmed characters                 |
| `parentSlug`   | Optional existing/input parent; omitted means root |

| Project field                   | Rules                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------- |
| `name`, `slug`, `repositoryUrl` | Required; name 2–100 characters, GitHub URL canonicalized                       |
| `tagline`, `description`        | Optional; at most 100/300 trimmed characters                                    |
| `websiteUrl`                    | Optional HTTP(S) URL                                                            |
| `logo`, `screenshot`            | Optional HTTP(S) URL or valid final storage key; `tmp/*` is rejected            |
| `content`                       | Optional Markdown/text; explicit empty string takes precedence over README      |
| `status`                        | Optional; default `draft`; also `published`, `rejected`, `removed`              |
| `categorySlugs`                 | Optional JSON array or pipe-separated CSV; up to three distinct leaf categories |

For CSV, separate category slugs with `|`, for example `ai-editors|general-editors`.

A published record must satisfy the same publish schema as the API, including
logo, nonempty tagline/description, and 1–3 leaf categories. The importer does not
upload media or verify that a supplied image exists. Unknown categories are not
created implicitly. See [seed-file-validation.ts](../packages/db/src/seed-file-validation.ts)
and [shared schemas](../packages/shared/src/schemas) for exact validation.

### Transactions and repeat imports

Categories are planned parent-first regardless of file order. Hierarchies may
have at most three levels and no cycles. A directly assigned category cannot
gain children, and a path cannot take over another category's historical path.

Categories match by slug; projects match by slug or canonical repository. If
these identify different existing projects, the import fails. Existing records
are skipped in full, including their metadata and assignments. Re-importing a
modified file is not an update operation. Duplicate slugs/repositories within the
input are rejected.

All writes commit in one transaction with the shared taxonomy integrity lock.
Validation, conflicts, or write failures roll back the entire import. Output
reports created/skipped totals; in dry-run, created counts mean planned records.
Errors include input location/field and return a nonzero exit code.

### Optional GitHub fetching

```sh
# Use real, reviewed public repository URLs before enabling network access.
vp run db:seed -- --categories ./data/categories.json --projects ./data/projects.json --github --dry-run
```

Without `--github`, no network requests occur: new repository rows contain basic
identity, zero counters, and an epoch timestamp marking an unfetched
snapshot. No star history is invented. With `--github`, only new projects fetch
public repository metadata and README before the write transaction. Optional
`GITHUB_TOKEN` supplies quota; otherwise public unauthenticated quota applies.
Dry-run still fetches when `--github` is set.

Metadata failure aborts import. Missing/invalid README produces a warning;
file content wins when supplied. README input is limited to 100 KiB. Resolved
rename/transfer identity and conflicts are rechecked before writes. Use the
normal GitHub refresh worker to build subsequent observed history.

### Troubleshooting and verification

`ENOENT` means a file path is wrong for the current directory. Missing table or
column errors require checking the target URL and applying migrations to that
same database; do not reset existing application schemas to repair an import.

Importer tests use synthetic data, mock GitHub, and disposable schemas, following
the [targeted verification](#targeted-verification) setup:

```sh
vp run db:test:start
vp run --filter @altstack/db test:scoped -- vp run --filter @altstack/db test run tests/seed-file-parser.test.ts tests/seed-file-import.test.ts tests/seed-file-cli.test.ts
```

The importer does not seed users, update existing records, accept spreadsheets,
or provide an upload UI.

## Targeted verification

Select tests for the feature and its affected callers. For documentation-only
changes, review the diff, links, and formatting; application tests are unnecessary.

```sh
# Substitute the files you changed.
vp fmt README.md docs/development.md --check
vp lint apps/web/src/components/workspace-header.tsx
vp exec tsrs --noEmit -p apps/web/tsconfig.json

# A web unit test that does not need the database.
vp run --filter web test:unit tests/project-embed.test.tsx

# Database-backed API tests in a migrated disposable schema.
vp run db:test:start
vp run --filter @altstack/db test:scoped -- vp run --filter @altstack/api test run tests/bookmark.test.ts
```

The wrapper sets up migrations, taxonomy, and a synthetic project in a temporary
schema, runs the child command from the repository root, and removes the schema
on success or failure. Test helpers require a local `TEST_DATABASE_URL` whose
database is `altstack_test`; they never fall back to `DATABASE_URL`. Direct
database test cases also own separate temporary schemas. See
[the test wrapper](../packages/db/tests/run-scoped.ts) and
[test helpers](../packages/db/tests/helpers).

The legacy `test:isolated` wrapper resets `public`/`drizzle` within the local test
database. Reserve it for acceptance scripts that explicitly require that layout.
HTTP acceptance scripts such as `vp run --filter web test:auth-http` manage their
own wrapper and build/start local application processes; check the script before
running it and keep the expected ports available.

`vp run test:docker` starts the test database and runs the recursive test suite.
`vp run ready` also runs repository-wide formatting/lint, type checks, tests,
and builds. Use these broad checks only for justified repository-wide changes or
an explicit baseline, following [Testing Scope](../AGENTS.md#testing-scope).
Stop the test service with `db:test:stop`, or remove it with `db:test:down`.

## Browser tests

Vitest Browser Mode runs Chromium through Playwright without an app server or
database. Browser tests live in `apps/web/tests/browser/**/*.browser.ts(x)` and
are separate from unit `*.test.*` files.

```sh
vp run test:browser:install
vp run --filter web test:browser tests/browser/crop-image.browser.ts
vp run --filter web test:browser:watch
```

Reinstall the browser after Playwright upgrades. Linux CI may need OS libraries;
use `vp exec --filter web playwright install --with-deps chromium` in that setup.
The web `test` script currently runs unit tests only; browser tests are explicit.

## Generated assets and editor support

- Route generation is managed by the TanStack plugin; do not hand-edit
  `routeTree.gen.ts`. `vp run --filter web generate-routes` regenerates it.
- `vp run --filter web generate:og` rebuilds the static social image using
  bundled fonts and artwork. Commit its output when the design changes.
- `vp run --filter @altstack/ui email:preview` writes synthetic HTML/text previews
  locally without a provider, database, or live authentication token. Generated
  HTML/text under `docs/email-previews/` is ignored by Git; the source templates
  remain in [packages/ui/src/emails](../packages/ui/src/emails).
- The workspace pins `tsrs` for type checking. VS Code's recommended
  **TypeScript 7** extension uses the launcher under `.vscode/tsdk`; restart the
  TypeScript server after dependency changes. Formatting/lint use Oxc/Vite+.

## Troubleshooting

Missing-variable errors usually mean `.env.example` was copied without replacing
required placeholders. Check [configuration](#configuration), including minimum
secret lengths. Database connection errors require the correct Compose service,
port, database name, and matching password. Missing tables/columns require the
migration chain on that same database.

If OAuth succeeds but SSR appears signed out, use `localhost` consistently for
both local origins, leave `BETTER_AUTH_COOKIE_DOMAIN` empty, and check the
GitHub callback URL. For separate HTTPS hosts, follow the
[cookie guidance](#origins-and-cookies).
