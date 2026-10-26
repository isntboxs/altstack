# Admin workspace

Implemented locally on this branch. This document does not claim a production
deployment. No database migration or additional scheduler is required.

## Navigation and work queues

The public account menu and sidebar brand lead administrators to `/admin`.
The sidebar separates Workspace, Moderation, Catalog, Administration, and Personal.
It includes live work counts, collapsible groups, project submenus, a Create Project
shortcut, icon-mode tooltips, the mobile sheet, and the standard sidebar trigger
and rail. Owner/maintainer work remains under `/managed`; administrators open
their eligible access requests at `/admin/ownership`.

- `/admin`: published projects, community drafts needing review, open reports,
  and ownership requests the current admin can review. Up to five oldest records
  in each queue link to their existing review flows. Submission timestamps mean
  project creation, not an inferred last-submitted time.
- `/admin/submissions`: reuses project review/edit, mandatory rejection feedback,
  and review history. The admin catalog retains projects with missing GitHub snapshots (`github: null`),
  so KPI totals remain navigable. The server filter always means draft plus a non-null
  submitter. `/projects` supports persistent status/name/page/sort/order filters.
- `/admin/reports`: persistent status/cursor pagination and exact `reportId` links.
  Cursor history is retained in the URL for previous pages and reloads.
- `/admin/ownership`: paginated reviewable claims and exact `claimId` links. Uses
  the existing inbox and review API, including active-account checks, no
  self-review, member authority, GitHub re-verification, manual evidence, and
  transactional concurrency protection. Decisions require confirmation.
- Catalog exposes all projects, project creation, categories/category creation,
  tags, and featured curation. Personal projects and bookmarks remain separate.

KPI filters and workflow links survive reload. The status chart is a snapshot of
actual project counts, not a time series. Failed reads show retry states rather
than zero counts. Dashboard and operations observations refresh every minute;
project/report/ownership changes invalidate relevant cached observations.

## Recorded activity

`/admin/activity` reads only `audit_log`, newest first, with stable ID tie-breaking,
page size at most 50, and action, actor ID, project ID, and inclusive UTC date
filters. UI pagination and filters live in the URL. The feed includes the existing
project, ownership, membership, and account actions. Report decisions and taxonomy
changes have no recorded audit events and are not fabricated.

The API selects actor/target names and an explicit status/role metadata allowlist.
It never returns raw audit metadata, private GitHub/manual evidence, rejection/ban
reasons, account email, session tokens, or provider data. Project review history
and account detail remain in their existing admin workflows. Deleted actors and
targets display as unavailable.

## Operations and limitations

`/admin/operations` reads published-project GitHub snapshots and the private review
notification outbox. It reports fresh/stale/missing snapshots using a visible
48-hour threshold, latest/oldest successful snapshot timestamps, and outbox
pending/failed/sent/cancelled counts, due pending items, oldest pending, and last
sent timestamps. Timestamp aggregates use the database column decoders so UTC
timestamps remain correct across server timezones.

GitHub batch failures and scheduler health have **unavailable** telemetry because
existing jobs log outcomes without persisting run measurements. Snapshot freshness
does not prove scheduler health or failure. Outbox `sent` means provider acceptance,
not confirmed inbox delivery. No secrets, email payloads, execution buttons, or
arbitrary retry controls are exposed. Existing scheduled workers retain delivery
and refresh responsibility.

The three dashboard API endpoints (`QUERY /admin/dashboard`, `/admin/activity`,
`/admin/operations`) use server-side admin authorization. Reads use repeatable-read,
read-only transactions and bounded queue/detail projections, with no per-row API
calls. Claim metrics share the real inbox eligibility predicate.

## Validation

Use `vp install` first. Database tests run in disposable PostgreSQL schemas through
the existing test wrapper:

```sh
vp run db:test:start
vp run --filter @altstack/db test:scoped -- vp run --filter @altstack/api test run tests/admin-dashboard.test.ts tests/admin-report.test.ts tests/ownership.test.ts tests/admin-project-list.test.ts tests/admin-project-review-history.test.ts tests/openapi-mapping.test.ts
vp run --filter web test --maxWorkers=1 --execArgv=--max-old-space-size=1024 tests/admin-dashboard-route.test.tsx
vp run --filter web test --maxWorkers=1 --execArgv=--max-old-space-size=1024 tests/admin-reports-route.test.tsx tests/admin-project-data-table.test.tsx tests/submission-navigation.test.tsx tests/project-report-route.test.tsx
vp exec tsc --noEmit -p apps/web/tsconfig.json
vp exec tsc --noEmit -p packages/api/tsconfig.json
vp run --filter web build
vp run --filter server build
```

Validation completed: 160 API tests and 47 UI tests passed, along with web/API
typechecks, changed-file formatting and lint, web/server builds, and
`git diff --check`. UI tests were split into bounded worker runs after concurrent
checks encountered SIGKILLs. Visual browser smoke testing was not performed.

Format and lint the changed files with `vp fmt <files> --check` and
`vp lint <files>`. No production rollout is part of this implementation.
