# Database package

Drizzle schema/relations, PostgreSQL migrations, CSV/JSON import, and disposable
test database helpers. Start with the [root setup](../../README.md#run-locally).
Run these commands from the repository root:

```sh
vp run db:start
vp run db:check-project-slugs
vp run db:migrate
vp run --filter @altstack/db db:validate-audit-actions
```

[src/schemas.ts](src/schemas.ts) exports the models,
[src/relations.ts](src/relations.ts) defines relations, and
[src/migrations](src/migrations) holds the migration chain. Schema changes require
review of the generated SQL; preserve existing data and migration history. The
separate audit constraint validation runs after migration commit and is safe to
repeat.

The read-only project-slug check also runs before `db:migrate`. Existing projects
using reserved routes such as `collections` must be renamed before rollout; a
collision blocks migration without changing the project. See the
[remediation procedure](../../docs/deployment.md#reserved-project-slugs).

Development uses persistent local `altstack` on port 5432. Tests require separate
local `altstack_test` on port 5433 and never fall back to the application URL.
The `test:scoped` wrapper migrates and seeds a temporary schema, runs its child
command, and cleans it up. Direct DB tests also own disposable schemas.

```sh
vp run db:test:start
vp run --filter @altstack/db test:scoped -- vp run --filter @altstack/db test run tests/bookmarks.test.ts
```

See [development](../../docs/development.md) for database lifecycle and test scope,
[data import](../../docs/development.md#data-import) for file formats/idempotency, and
[deployment](../../docs/deployment.md) for migration and recovery procedures.
