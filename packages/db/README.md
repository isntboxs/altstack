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

Use a running Docker daemon and the `postgres:18` image. Each DB test run creates a
new PostgreSQL container with a random loopback port and temporary in-memory data,
and each test creates a separate database. The helper never reads `DATABASE_URL`.
Containers are removed in teardown, including on assertion failures.

```sh
vp install
vp run --filter @altstack/db test
vp check
```

Existing API tests use the environment DB and expect a published backend project.
Run workspace verification through this wrapper to supply a disposable database,
synthetic credentials, and a synthetic backend fixture:

```sh
vp run --filter @altstack/db test:isolated -- vp test
vp run --filter @altstack/db test:isolated -- vp run ready
```

The wrapper defaults to `vp run ready` when no command is supplied. It applies the
real migrations and calls only `seedTaxonomy`, without running the network-based
project seed. Do not run the ordinary DB mutation commands or API tests against
an uninspected `.env` database.

The reusable `tests/fixtures/category-hierarchy.ts` fixture creates Zed with
synthetic repository metadata and two direct sibling leaf assignments. Its default
status is draft; tests can explicitly request another status. It owns and disposes
only its project and cascading metadata/assignment rows; the disposable database
owns the taxonomy. It is outside the package's production source/build entries and
is never included in the production seed.

Tests cover empty and existing migration chains, migration reruns, preservation of
legacy assignments and taxonomy, constraints/indexes, historical path ownership,
twice-run taxonomy idempotency, actual existing ancestry, rollback on conflicts,
relations, and fixture teardown.

## Next: PR2 public API

After PR1 merges, implement public hierarchy reads, canonical path resolution and
historical path redirects, and deduplicated ancestor aggregation of published
projects. Project detail categories remain direct assignments, with globally unique
slugs compatible with `categorySlugs`. Admin mutations/locking and both frontends
remain in their later PRs. PR1 changes no API/frontend contracts or UI.
