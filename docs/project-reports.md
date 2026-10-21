# Report / suggest correction

Published project pages expose **Report** on desktop and in the compact/mobile
**More** menu. `/<slug>?dialog=report` opens the dialog, including on direct entry
and reload. The existing `dialog=embed` discriminator remains mutually exclusive.
Opening/closing preserves unrelated search parameters, the hash, scroll and
loaded project data. Cancel, Close, Escape and outside click remove the dialog
parameter; browser back/forward follows URL state and focus returns to Report or
More. Dialog navigation does not refetch the project or show a page skeleton.

Guests enter a valid email (maximum 254 characters). Signed-in users and admins
only edit Type and Message; the server uses the current session's user ID/email,
ignoring a supplied email. If the session expires, refresh the session or reload
to enter a guest contact before retrying.
Type is required: **Broken link**, **Wrong category**, **Outdated**, **Other**.
Message is trimmed and limited to 2,000 characters, optional except for Other,
which requires nonblank text. Shared schemas enforce these rules on both sides.

`report.create({ params: { id }, body: { type, message?, email? } })` and
`POST /api/reference/projects/{id}/reports` persist to `project_reports`. Success
returns only `{ received: true }`, after the transaction commits. A project row
share lock protects published visibility until commit; missing/draft/rejected/
removed targets receive the same NOT_FOUND response, including for admins.
Persistence errors return a generic server error. The form preserves entries on
failure, prevents repeat sends while pending, never retries automatically, and
clears/closes only after successful persistence. A lost response can still mean a
committed report; a later manual retry can create another report.

Report contact, message and identity stay outside public project data and
projections. The admin inbox below provides private triage; there is no public
report read endpoint, external email delivery or automatic project correction.
Deleting a project now clears its report project FK and retains the reports;
deleting an account clears the user FK but retains its submitted contact.
No additional retention job is introduced.

## Admin inbox

Admins open **Reports** in the workspace sidebar at `/admin/reports`. The table
shows project/logo, reporter email (including guest contact), type, plain text
message, submitted time, status and actions. It defaults to **Open**, newest
first; filters also include Resolved, Dismissed and All statuses. The table uses
the existing admin table/button/badge components and scrolls horizontally on
narrow screens. Loading, read errors/retry, empty pages and mutation feedback are
explicit. Refresh inbox returns to the first page.

**Edit project** opens the existing `/projects/{id}/edit` page. Draft, rejected
and removed projects remain visible in the inbox with their current visibility
and a valid admin edit target. A deleted project displays **Project deleted**,
with no edit link; its retained report can still be reviewed. Reports deleted by
the old cascade before this migration cannot be recovered.

New and migrated reports default to **Open**. Admins may choose **Resolve** or
**Dismiss**, producing the terminal states Resolved or Dismissed. There is no
reopen, assignment, comment or email workflow. Decisions change only the report
status; project copy, categories, visibility and bookmarks are untouched.

The oRPC APIs are `admin.report.list({ query: { status?, limit?, cursor? } })` and
`admin.report.moderate({ params: { id }, body: { status } })`. REST equivalents
are `QUERY /api/reference/admin/reports` and
`PATCH /api/reference/admin/reports/{id}`. Both independently enforce admin
authorization (401 without a session, 403 for a non-admin). API responses and
workspace HTML carry `Cache-Control: private, no-store`; workspace HTML is
noindex. Public project/submission responses never include reports.

Lists return `{ reports, nextCursor }`, at most 12 reports by default (limit
1–50). Cursor pagination orders by immutable `(created_at DESC, id DESC)` and
anchors using the report ID and the database's exact timestamp. New arrivals or
moderating the anchor do not shift the next page. A missing cursor is a 400;
Refresh inbox starts again. Previous pages are read again and may reflect newer
decisions; an emptied page remains navigable with Previous/Refresh.

Moderation atomically updates only `status = 'open'`. A missing report returns
404, malformed IDs/unsupported status/extra body fields return 400, and an
already reviewed report returns 409 (including retrying the same decision).
Concurrent decisions have one winner. The UI disables repeat actions while
pending, never automatically retries writes, and invalidates every report-list
filter after success or failure, since a lost response may still have committed.
Failure feedback asks the admin to refresh before retrying.

## Abuse protection

Reports reuse the existing oRPC Upstash adapter/Redis client, separate from the
submission quota: **5 validated attempts per 10 minutes** per authenticated
account (including admins), or per normalized guest email hash. Guests also share
an environment-wide **50 attempts per 10 minutes** cap. Keys use
`altstack:<NODE_ENV>:report:identity` and `altstack:<NODE_ENV>:report:guest`.
Raw emails and IP addresses are not used in Redis keys. Email hashes are not a
promise of anonymization. Guest email is unverified; the shared anonymous cap
bounds intake when addresses are rotated and can temporarily limit other guests.
No forwarding headers are trusted and no IP tracking/CAPTCHA is introduced.
Use edge/WAF protection for network-level floods if needed.

Invalid payloads/contact do not consume quota; valid attempts consume quota even
when target lookup or persistence fails. Redis errors fail closed, with the
existing five-second request deadline and no local fallback. HTTP quota errors
include 429, quota data, RateLimit headers and Retry-After through existing CORS.
The UI displays the quota failure and waits for an explicit retry.

## Rollout and verification

Apply additive migration `20261021082531_project-reports` with `vp run db:migrate`
before rolling out the API, then the web build. It creates only the intake table,
constraints, foreign keys and indexes; existing project/bookmark data is preserved.
Use the existing server-only Upstash credentials (dedicated development Redis
locally); no new secret, service or client environment variable is required.
No deployment or migration to shared application data is performed by tests.

For the admin inbox, apply **`20261021115045_admin-report-inbox` before the new
API/web** through the authorized rollout process. It adds the nonnull status with
default Open (retaining existing intake), its CHECK and pagination indexes, and
changes the project FK from cascade to nullable `ON DELETE SET NULL`. It neither
resets data nor changes project visibility. The old intake API remains compatible
with the added default. An older API that ignores report status can run against
the migrated schema, but rolling back the migration itself requires a separate
data-preserving plan for moderated and orphaned reports. No new env/secret is
required. Implementation verification only migrates disposable test schemas;
shared/public application schemas and production are untouched.

Run database-backed checks only through the disposable-schema wrapper:

```sh
vp install
vp check
vp run typecheck
vp run --filter @altstack/db test:scoped -- vp test run
vp run --filter @altstack/db test:scoped -- vp run -r test
vp run -r build
# Real HTTP/SSR sessions and optional interactive T3 preview, isolated DB only:
VITE_APP_URL=http://localhost:3110 VITE_SERVER_URL=http://localhost:3109 \
  vp run --filter @altstack/db test:scoped -- \
  vp exec node apps/web/tests/admin-reports-http.acceptance.ts --preview
```

Focused tests live in shared `tests/report.test.ts`, API `tests/report.test.ts`
(real migrated disposable schemas, mocked Redis), web `tests/project-report*.test.tsx`,
with browser QA of the real application through T3 preview. They cover contact/session
spoofing, conditional validation, private persistence and errors, nonpublic targets,
quota enforcement, both forms, and URL/focus/keyboard lifecycle. Existing Embed and
Bookmarks tests remain regression coverage.

Admin coverage is in shared `tests/admin-report.test.ts`, API
`tests/admin-report.test.ts`, DB `tests/admin-reports.test.ts`, and web
`tests/admin-reports-route.test.tsx` plus `tests/admin-reports-http.acceptance.ts`.
These exercise migration preservation/defaults/constraints, RPC and REST
401/403 before DB access, private guest contact, all visibility states/deleted
targets, terminal and concurrent decisions, bounded filters/cursor ties, plain
text rendering, edit destinations, pending/error/empty UI, repeat prevention and
list invalidation. HTTP acceptance builds the application, signs in synthetic
accounts and checks real cookies, headers, public HTML privacy and status APIs.
`--preview` retains only that disposable schema/server for up to 20 minutes;
create `stop-preview` in the printed temporary evidence directory to clean up
immediately. Redis is mocked in intake tests; no live Redis, GitHub or storage
integration is needed for the admin inbox.

## Implementation verification — 2026-10-21

Verified in `feat/admin-reports`, based on merged intake `9d404c2`:

- `vp install`: passed; no new dependency required.
- `vp check --fix`: passed with no lint/type warnings or errors.
- `vp run typecheck`: all eight app/package checks passed.
- `vp run --filter @altstack/db test:scoped -- vp test run`: **1,142 passed, 1 skipped**, 80 passing files.
- `vp run --filter @altstack/db test:scoped -- vp run -r test`: **1,140 passed, 1 skipped**, seven successful workspace tasks.
- `vp run test:browser`: **9 passed** in real Chromium.
- `vp run -r build` (inside the HTTP acceptance harness): all eight builds passed. Existing large client chunk and dependency module-level directive warnings remain.
- HTTP acceptance through `test:scoped` with `vp exec node apps/web/tests/admin-reports-http.acceptance.ts --skip-build`: passed with exit 0 against those builds; servers and disposable schema cleaned up. Run this harness with Node, which isolates detached server process groups; it rejects Bun execution.
- T3 preview: real guest/user/admin sessions, exclusive admin navigation, 401/403, deleted/unpublished targets, plain text script markup, editor navigation, Resolve/Dismiss, status filtering, cursor controls, and network failure/retry. Desktop 1440×1000 and mobile 390×844 were checked; table scrolling stays inside the mobile page and the mobile sidebar closes on navigation.

The skipped test is the opt-in Upstash integration; intake quotas are mocked in
the regression suite. No live GitHub, Redis or storage integration was performed.
All database QA used disposable schemas on the authorized development database.
No shared application migration, production access, deployment or merge occurred.
