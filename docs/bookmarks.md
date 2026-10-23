# Private Bookmarks

Implemented on the Bookmarks feature branch after v0.2.0; deployment and merge
are separate steps. All authenticated accounts, including admins, can bookmark
published projects. Guests use the existing sign-in dialog and return to the
project; saving still requires an explicit click after login.

The account menu and workspace sidebar link to protected `/bookmarks`. Its table
has exactly Name (logo and public `/$slug` link), Description (tagline), and Action
(one Remove button). Removing a bookmark never deletes a project. Lists are
paginated, newest saved first, with a project ID tie breaker; the page returns to
the last valid page after removals. Empty, loading, retry and mutation error states
are included. Verify and Report remain deferred.

## Storage and API

`bookmarks` has primary key `(user_id, project_id)`, a per-user date/order index,
and an index for project deletion. Both foreign keys cascade on deletion. Save
uses `ON CONFLICT DO NOTHING` without changing the original saved date and locks
the published project while inserting. Remove is idempotent and scoped to the
session account. Concurrent save/remove requests may complete in either order;
the UI serializes writes for each account/project and disables pending actions.

The oRPC `bookmark` namespace exposes `list`, `get`, `save`, and `remove`. OpenAPI
maps them under `/api/reference/bookmarks`: `QUERY /`, and `QUERY`, `PUT`, `DELETE`
on `/{id}` where `id` is a project ID. All four procedures require a server-side
session. Input cannot select another account, including for admins. Read/save
return the same 404 for missing and nonpublished projects. Remove returns
`{ bookmarked: false }` regardless of existence without exposing project details.

Only published projects contribute to rows and counts. Unpublished bookmarks are
retained privately and reappear if republished; an API removal can clean them up.
Deleted projects/accounts cascade their bookmarks. The list sends only project
ID, name, slug, logo and tagline. Private queries are keyed by account, removed
from the query cache when unused, and refreshed on entry/focus. Bookmark API and
HTML responses use `private, no-store`; the page is excluded from indexing.

## Rollout

Apply additive migration `20261020170200_bookmarks` using `vp run db:migrate`
against the intended deployment database **before** releasing the new API and
web build. No backfill or application data reset is required. The migration only
creates the bookmark table, constraints and indexes. Old application builds
ignore the new table, so an application rollback can leave it in place and
preserve saved bookmarks. Do not drop it during an application rollback.

Migration verification uses the documented development disposable schemas. This
implementation does not apply migrations to application `public` or production.

## Verification

```sh
vp install
vp check
vp run typecheck
vp run --filter @altstack/db test:scoped -- vp test run
vp run --filter @altstack/db test:scoped -- vp run -r test
NODE_ENV=production vp run -r build
vp run --filter web test:bookmarks-http
```

The DB suite checks additive migration over existing records, migration reruns,
primary key uniqueness, indexes, relations and account cleanup. API tests cover
regular/admin access, anonymous rejection, cross-account isolation, duplicate and
concurrent saves/removes, published-only counts/pagination, unpublish and delete,
and actual RPC/OpenAPI codecs. UI tests cover both responsive actions, login
handoff, pending/error/retry, private cache keys, navigation, protected route
loading/recovery, removal and empty-page recovery. HTTP acceptance runs local
compiled API/SSR with synthetic accounts inside the disposable development
schema; it verifies real cookies, persistence, visibility, indexing and caching.
The production build explicitly sets `NODE_ENV` so a development `.env` cannot
select a development JSX runtime for the local compiled production server.

For T3 preview QA after building, keep the same local acceptance servers alive:

```sh
vp run --filter @altstack/db test:scoped -- bun run apps/web/tests/bookmarks-http.acceptance.ts --skip-build --preview
```

The command prints a temporary evidence directory. `preview.json` there contains
only synthetic fixture emails, identifiers, and a local mock mailbox URL.
Request a Magic Link from the UI and redeem it through the test mailbox; see
[auth QA](auth.md#safe-validation). Create `stop-preview`
in that directory after QA; the command closes both servers and the wrapper
drops its disposable schema. Preview mode also stops after 20 minutes. Do not
use real account credentials or the historical `test:isolated` wrapper.

## Branch verification — 2026-10-21

Verified from baseline `7c83628` in the bound `feat/bookmarks` worktree:

- `vp install`, `vp check` (zero warnings/errors), and all eight `typecheck`
  targets passed.
- Recursive tests passed: shared 186, DB 99, auth 5, API 441, web/browser 355
  (1,086 passed total). The dedicated opt-in Upstash integration test was skipped.
- Root `vp test run` also passed: 1,085 tests across 72 files, with the same
  opt-in integration skipped. The additional Chromium crop test runs in the
  recursive web/browser suite.
- `NODE_ENV=production vp run -r build` passed for all eight targets. Existing
  large-chunk, Shiki dynamic-import and dependency module-directive warnings remain.
- Local compiled HTTP acceptance passed with synthetic user/admin accounts.
  The preview servers exited successfully and their disposable schema was removed.
- T3 preview QA passed at 1440, 1024 and 390 CSS pixels: guest login handoff,
  desktop/compact/mobile save and reload persistence, user/admin private state,
  account-menu navigation, three table columns with one Remove per row, empty
  state, disabled pending action, simulated network failure and retry, and
  sign-out redirect without private project content. Mobile horizontal scrolling
  stays inside the table container.

Application `public` and production were not migrated or used for test data.
Merge and deployment acceptance remain separate from this branch verification.
