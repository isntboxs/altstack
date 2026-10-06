# Category hierarchy database foundation (PR1)

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

## Isolated verification

The test helper connects to the cloud `DATABASE_URL` from the root `.env` and
preserves its SSL and connection parameters. Both URL validation and a server
identity query require `altstack_development`. Each DB case creates an
`altstack_test_<uuid>` schema in that database, with its own connection search path
and Drizzle migration ledger. The search path excludes `public`; case teardown
closes the pool and drops only its schema, including after assertion failures.
Direct DB tests do not reset the application schemas.

```sh
vp install
vp run --filter @altstack/db test
vp check
```

Existing API tests use the application schemas and expect a published backend
project. Run workspace verification through this wrapper:

```sh
vp run --filter @altstack/db test:isolated -- vp test
vp run --filter @altstack/db test:isolated -- vp run ready
```

The wrapper resets `public` and `drizzle` in `altstack_development` before running
verification. Existing development data is deleted. It applies the real migration
chain, seeds the taxonomy, and inserts a synthetic backend project. External
GitHub/storage credentials are replaced with synthetic values for the child
command. The root `.env` remains unchanged.

After success, a nonzero command exit, or a thrown verification error, the wrapper
resets those application schemas again, applies the migrations, and seeds only the
taxonomy. The final database contains the current schema and ten categories/path
mappings, with no project fixtures. DB cases remain isolated in temporary schemas
while API tests use `public`. Tests use 30-second timeouts and 60-second hooks.

The wrapper defaults to `vp run ready` when no command is supplied. It never runs
the network-based project seed. A cleanup or migration failure is reported as a
failure rather than a successful restoration. The target guard rejects databases
other than `altstack_development` before attempting to reset them.

The reusable `tests/fixtures/category-hierarchy.ts` fixture creates Zed with
synthetic repository metadata and two direct sibling leaf assignments. Its default
status is draft; tests can explicitly request another status. It owns and disposes
only its project and cascading metadata/assignment rows; the isolated test schema
owns the taxonomy. It is outside the package's production source/build entries and
is never included in the production seed.

Tests cover empty and existing migration chains, migration reruns, preservation of
legacy assignments and taxonomy, constraints/indexes, historical path ownership,
twice-run taxonomy idempotency, actual existing ancestry, rollback on conflicts,
relations, and fixture teardown. Cloud harness tests also cover schema isolation,
connection parameter preservation, unauthorized targets, and cleanup after
successful and failed verification.

## Next: PR2 public API

After PR1 merges, implement public hierarchy reads, canonical path resolution and
historical path redirects, and deduplicated ancestor aggregation of published
projects. Project detail categories remain direct assignments, with globally unique
slugs compatible with `categorySlugs`. Admin mutations/locking and both frontends
remain in their later PRs. PR1 changes no API/frontend contracts or UI.
