# Category hierarchy database foundation (PR1)

Untuk importer CSV/JSON, lihat [panduan file seeding](../../docs/file-seeding.md).
Root [README](../../README.md#development) adalah sumber verifikasi saat ini:
gunakan `test:scoped` yang menjaga data aplikasi.

`categories.parentId` is nullable, indexed, and references `categories.id` with
`ON DELETE RESTRICT`. The self-parent check is the only new hierarchy check.
Globally unique slugs and `project_categories` are unchanged. Drizzle exposes
`category.parent`, `category.children`, `category.paths`, and
`categoryPath.category`.

`category_paths` reserves relative paths using a text primary key, with an indexed
category FK and `ON DELETE CASCADE`. Current and historical paths point directly
to category IDs. Canonical paths come from the current parent hierarchy and slugs;
there is no redirect chain or stored canonical flag.

The generated migration and snapshot are in
`src/migrations/20261005225519_category-hierarchy`. The SQL adds the column,
table, indexes, and constraints, then backfills every existing root slug. Existing
IDs, category fields, projects, and assignments are preserved. Drizzle generation
also repeated the audit action check from the earlier custom migration
`20261003023128_add-project-updated-audit` (which has no snapshot). That redundant
SQL was removed; the new generated snapshot reflects the already-applied check.

`seedTaxonomy(database)` from `@altstack/db/seed-taxonomy` has no connection,
environment, or network side effects on import. It inserts missing categories
parent-first and leaves existing rows untouched. The original six flat categories
retain their definitions; `devtools` stays separate from `developer-tools`.
The four new categories form Developer Tools → IDEs & Code Editors → General
Purpose Editors / AI-Powered Editors. Path insertion follows actual ancestry,
including admin-moved existing entries and ancestors outside the seed. Existing
paths are retained. A path owned by another category aborts the whole transaction.
Cycle detection only prevents the seed path walk from looping; API hierarchy
validation and advisory locking belong to PR3.

## Deferred audit constraint validation

Migration `20261026115414_member-user-management` expands the audit action check
with `NOT VALID`. Existing rows satisfy the former, narrower check, and all new
inserts/updates must satisfy the expanded check immediately. Run these commands
in sequence against the same configured `DATABASE_URL` before the matching app
rollout:

```sh
vp run db:migrate
vp run --filter @altstack/db db:validate-audit-actions
```

The second command runs in a separate connection after migration commit and is
safe to repeat. Validation acquires `SHARE UPDATE EXCLUSIVE`, allowing ordinary
reads and writes. Keep it outside the migration batch: Drizzle wraps all pending
migration files in one transaction, so splitting validation into another numbered
file would retain the exclusive lock from the constraint replacement. No data or
allowed action is removed. The migration regression test runs this follow-up
with a concurrent audit writer and verifies both enforcement and validation.

## Disposable-schema verification

Root [README](../../README.md#development) is the verification source of truth.
Development uses the Docker Compose `postgres` service (`altstack`, port 5432)
with a persistent volume. Tests use the separate `postgres-test` service
(`altstack_test`, port 5433) with temporary storage.
The test helper connects using `TEST_DATABASE_URL` from the root `.env`, preserving
connection parameters, and never falls back to the application's `DATABASE_URL`.
URL validation requires a local host (`localhost`, `127.0.0.1`, `::1`, or the
Compose service `postgres-test`); a server identity query also requires
`altstack_test`. Each direct DB case creates an `altstack_test_<uuid>`
schema with its own search path and Drizzle migration ledger. The search path
excludes `public`; teardown closes the pool and drops only its test schema.

Existing API tests require a published backend fixture. Run workspace verification
through `test:scoped`, which gives the entire child command another disposable
schema, applies the real migration chain, seeds the taxonomy, and inserts a
synthetic backend project:

```sh
vp install
vp check
vp run db:test:start
vp run --filter @altstack/db test:scoped -- vp run -r test
vp run --filter @altstack/db test:scoped -- vp run ready
```

The wrapper defaults to the recursive test suite when no command is supplied.
It cleans its temporary schema after success or failure. It never resets
application `public`/`drizzle` and does not rewrite the root `.env`. DB cases remain
in their own temporary schemas.
Cleanup failure is reported as failure. The root `vp run test:docker` command starts
the test database and runs the recursive suite through this wrapper.
The legacy `test:isolated` wrapper resets `public`/`drizzle` only in `altstack_test`;
use it only for acceptance scripts that require those schemas. Neither wrapper
can connect to the development database `altstack`.

CSV/JSON importer tests also create disposable schemas and use mock GitHub
clients. Coverage includes parser errors, hierarchy planning, historical path
ownership, leaf assignments, one-transaction rollback, idempotent preservation,
GitHub rename/conflict checks, dry-run, caller-relative CLI paths, and pool cleanup.

The reusable `tests/fixtures/category-hierarchy.ts` fixture creates Zed with
synthetic repository metadata and two direct sibling leaf assignments. Its default
status is draft; tests can explicitly request another status. It owns and disposes
only its project and cascading metadata/assignment rows; the isolated test schema
owns the taxonomy. It is outside the package's production source/build entries and
is never included in the production seed.

Tests cover empty and existing migration chains, migration reruns, preservation of
legacy assignments and taxonomy, constraints/indexes, historical path ownership,
twice-run taxonomy idempotency, actual existing ancestry, rollback on conflicts,
relations, and fixture teardown. Docker harness tests also cover schema isolation,
connection parameter preservation, unauthorized targets, and cleanup after
successful and failed verification.

## Next: PR2 public API

After PR1 merges, implement public hierarchy reads, canonical path resolution and
historical path redirects, and deduplicated ancestor aggregation of published
projects. Project detail categories remain direct assignments, with globally unique
slugs compatible with `categorySlugs`. Admin mutations/locking and both frontends
remain in their later PRs. PR1 changes no API/frontend contracts or UI.
