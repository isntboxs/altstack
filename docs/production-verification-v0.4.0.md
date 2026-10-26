# v0.4.0 production verification — 2026-10-24

Production was inspected and changed with the operator's authorization in this
thread. Checks began around **15:03 WIB (08:03 UTC)** on 2026-10-24.
Targets: [Altstack](https://altstack.marvagency.net),
[API](https://altstack-api.marvagency.net), and
[Dokploy](https://dokploy.marvagency.net).

**Result:** release, email delivery, GitHub synchronization, the focused product
journey, and the 20-listing catalogue checks passed. **Recovery readiness remains
open:** no database backup/restore exists, as confirmed by the operator. Storage
lifecycle inspection and the deliberately unexercised integrations below are not
claimed as passed.

**Follow-up — 2026-10-27 WIB:** private R2 backups are now configured daily at
03:00 WIB with 30-object retention. An actual off-host backup restored into an
isolated PostgreSQL instance with matching schema/data and passing integrity
checks; scheduler execution and pruning were also exercised. See the
[recovery runbook and remaining monitoring/hardening gaps](postgres-backup-restore.md).
The inspection findings below remain the historical 2026-10-24 record.

## Deployment and migrations

Both running containers report OCI version `v0.4.0` and revision
`b79593d748b2e3b23f17fdffad2b294ba04b985b`:

- API: `isntboxsss/altstack-server:latest`, container `ca11b8ce00e1`,
  image ID `sha256:9578b6957ec6687fc608b9a78c3f62faa53879728edd32f4566721a723dce8b2`.
- Web: `isntboxsss/altstack-web:latest`, container `a8cae8e41689`,
  image ID `sha256:7ed9ba8a203707c586127d8fcf4be1f9851257c153d814d21cf80eea798d9da8`.

The private migration journal has **25 applied entries**. The final five,
all applied at `2026-10-23T21:39:50.374Z`, are:

- `20261022111024_github-topic-tags`
- `20261022142815_organic_silver_samurai`
- `20261023062257_auth-rate-limit-retention`
- `20261023074640_submission-review-notifications`
- `20261023175513_github-license-archived`

Runtime configuration was checked without recording credentials:
`NODE_ENV=production`, `PORT=3009`, `TZ=Asia/Jakarta`,
`BETTER_AUTH_URL=https://altstack-api.marvagency.net`,
`BETTER_AUTH_COOKIE_DOMAIN=marvagency.net`, and both `EMAIL_APP_URL` and
`CORS_ORIGINS` point to `https://altstack.marvagency.net`.
GitHub OAuth/service token, Resend sender/key, PostgreSQL, Upstash and storage
settings are present. Real API requests and the service checks below establish
more than configuration presence alone.

## Review emails: repaired and exercised

The API application originally had only the GitHub schedule. Created and enabled:

- Name: `review-notifications-every-minute`
- Schedule ID: `YLuD6NdT_lp-cvo8te9mO`
- Application: `BFWppne50KhKIXVSS7CLy` (Server)
- Cron: `* * * * *`; timezone: `Asia/Jakarta`; shell: Bash
- Command: `cd /app && bun run apps/server/dist/jobs/review-notifications.mjs`

The first automatic run at **15:11 WIB** succeeded
(`I1PVsUTrekad7LVBW2PuP`); subsequent minute executions also report `done`.
This is an actual Dokploy container job, with no second worker platform.

An operator-owned Rollup submission exercised draft → rejected → corrected draft
→ published, using the signed-in account. The private outbox contains exactly
**2 sent rows**, one per decision, each with **1 attempt**, no last error and
**0 pending/failed/cancelled rows**:

- Rejected: `2026-10-24T08:12:01.865Z`.
- Published: `2026-10-24T08:17:01.867Z`.

The Resend API reported `delivered` for both decisions and Magic Link:

- Rejected provider ID: `01a16cf7-7eea-7902-8b5c-89b96248763a`.
- Published provider ID: `01a16cfc-12ee-771b-a13c-084e3e82a8a5`.
- Magic Link provider ID: `01a16cf7-a02d-7f20-bf4a-8181413a89b4`.

The operator independently confirmed rejection + Magic Link in the inbox,
successful Magic Link sign-in, and receipt of Published mail with both the public
project and private submissions links opening correctly. This is delivery and
inbox evidence for these messages, not a general guarantee against future bounces.
No recipient address, auth token, email body or provider credential is stored here.

## GitHub schedule and backfill

Existing `github-statistics-daily` schedule
`x6TIsVPdNP9_ywcDDULZP` is enabled at `0 2 * * *`, explicitly
`Asia/Jakarta`, running
`cd /app && bun run apps/server/dist/jobs/github-refresh.mjs`.

Daily runs from 2026-10-20 through 2026-10-24 reported `done`; the latest
scheduled execution was `2026-10-23T19:00:00.317Z` (**02:00 WIB October 24**).
At inspection, the seven existing projects still had null license/archived
metadata and empty public topics, from snapshots taken before the v0.4.0 deploy.

Manual run `F57-7U9YewfJZP-MdOwgH` at **15:11:24 WIB** succeeded with
`selected=7, succeeded=7, failed=0, skipped=false, rateLimited=false`.
Logs also contain successful auth-rate-limit and star-history retention events.
The backfill populated topics, license and archived data through the existing job.

After curation, a second manual run, `RA9IOf9th6YEy12p6HS27`, started at
`2026-10-24T08:30:18.615Z` (**15:30:18 WIB**) and completed in 27 seconds:
`selected=20, succeeded=20, failed=0, skipped=false, rateLimited=false`.
Both retention operations also succeeded. The existing daily command therefore
ran successfully against the complete final catalogue, not just the initial seven.

Original projects have 6–7 observed dates in the seven-day WIB window, sufficient
for Trending. The 13 newly published projects initially have one real date.
No historical stars or topics were invented; cold-start Trending remains honest.

## Live product and service checks

- Fresh GitHub OAuth initialization returned 200, followed GitHub authorization
  and the API callback, and returned to authenticated `/submission`.
- Magic Link request returned 200; the operator confirmed successful sign-in.
  A separate anonymous browser was redirected from `/submission` to
  `/auth/sign-in?returnTo=%2Fsubmission`, with a null session.
- UI submission created Rollup draft `a1de2245-6885-4649-b75a-2c5f2c1b5ec1`.
  Public detail returned 404 for both draft and rejected states; private feedback
  was readable by the submitting account. Resubmission returned 200/draft.
  Enrichment/publication returned 200, and public detail then returned 200.
  Four audit events record submitted, rejected, resubmitted and published states.
- Logo presign → upload → final-key promotion succeeded against real R2 storage.
  All **20 logos and 7 existing screenshots decoded successfully** through
  `https://cdn-altstack.marvagency.net`.
- Search `q=Prisma` returns Prisma. Category `database-tools`, tag `orm`,
  and their combination with license `apache-2.0` each return Prisma and
  Drizzle ORM; license-only returns those plus Supabase. Trending returns the
  catalogue with established observations before the new cold-start records.
- Shared filter URLs, back/forward navigation and a detail reload retained the
  expected results. Desktop 1440 px and mobile 360 px filter layouts had no
  horizontal overflow; the mobile Rollup detail had no failed images.
- Bookmark save/list/remove succeeded; the original unbookmarked state was
  restored. Report creation reached the admin inbox and was dismissed successfully.
  Test report `0622fc38-4846-45f8-93a8-b405aaae0e96` remains explicitly labelled
  as operator acceptance data. Existing Featured selections were served publicly.
- Anonymous direct admin/submission/bookmark/report-inbox requests returned 401.
  Bookmark and report-inbox responses retain `Cache-Control: private, no-store`.
  CORS preflight permits the real Web origin and supplies no allow-origin for an
  untrusted origin. Live submission/resubmission/report operations exercised
  the configured Upstash service without failure.
- HTTP checks passed for **20 public project pages, 7 category pages, tag/license
  discovery, combined filters, Trending, sitemap index, robots and email branding**.
  Browser fetches of `/rollup/badge.svg`, the Rollup OG PNG and the project
  sitemap shard returned 200 with their expected MIME types. A mistyped badge
  path was corrected; requests from Python's default bot user agent received
  edge 403s, while browser requests succeeded.

## Catalogue: 7 → 20 published listings

Rollup was retained as a real, enriched listing after the review/email journey.
At the operator's request for mixed developer-tool categories, 12 more projects
were curated from their official websites and public GitHub repositories:

Next.js, Astro, Svelte, Nuxt, Hono, Fastify, Drizzle ORM, Prisma, Better Auth,
Supabase, Appwrite and Dokploy. Six new leaf categories accompany the existing
Build Tools: Frontend Frameworks, Backend Frameworks, Database Tools,
Authentication, Backend Platforms and Deployment Tools.

All **20 canonical repositories are distinct**, public and nonarchived; all 20
official website links returned 200. Copy was checked against primary sources,
with logos from official site assets (Rollup uses its GitHub organization image).
Prisma's repository redirect was resolved to `https://github.com/prisma/orm`.
New records were created through the authenticated admin API, not direct SQL or
demo imports; admin-created listings have no submitter and send no decision mail.

Final discovery coverage: **119 public tags**; MIT 13, Apache-2.0 3,
BSD-3-Clause 1, unknown 3. Rollup, Astro and Dokploy have GitHub
`NOASSERTION`; keeping these unknown follows the shipped license policy.
Rollup, Vite+ and Vite Task have no upstream topics; their empty tags are honest.

The [public catalogue snapshot](production-catalogue-v0.4.0.json) records every
listing's canonical source, category, media result and observed-date count.
It contains no auth, contact or provider secrets and is not an import template.

## Open outcomes, owners and recovery

Follow-up policy and execution status are tracked in the
[PostgreSQL backup/restore runbook](postgres-backup-restore.md). The findings
below describe the 2026-10-24 inspection, not a new live verification.

- **Backup/restore — open, owner: deployment operator (mrboxs).** Dokploy's
  production PostgreSQL service has no backup configuration. The operator
  confirmed no backup/restore elsewhere. Next action: provision a private backup
  destination, configure an off-host database backup with retention, and restore
  a recent dump into an isolated database to prove recovery. No suitable private
  destination was supplied during this run. The public asset bucket is not a
  backup destination for authentication and review data.
- **Storage lifecycle — unverified, owner: storage operator (mrboxs).**
  Reading lifecycle configuration with the application's R2 credential returned
  `AccessDenied`/403. Upload/read works; this does not establish whether a
  lifecycle rule exists. Inspect the bucket with account-level access and record
  the temporary-object cleanup policy; do not broaden application credentials
  merely to pass an inspection.
- **Recovery procedure — documented, not executed.** Retain matching immutable
  API/Web revisions and review config, then use a known-good matching image pair
  for an application rollback. Existing additive migrations remain in place;
  do not reset the database or clear/replay outbox identities. Forward-fix
  through the normal release/migration process and recheck both jobs. A real
  database restore and production rollback were not attempted.
- **Additional acceptance — not exercised, owner: release operator.**
  No separate non-admin test account was available for a fresh live 403 check.
  Expiry/replay of Magic Link, forced session expiry/logout, capacity/quota
  exhaustion, removed-project visibility, initial admin bootstrap, browser
  mail-client matrix, social crawler caches and provider bounce handling were
  not tested in production. Existing accounts/data were not modified to force
  those conditions. Passing checks above do not imply these checks passed.

## Validation of this record

Only documentation and a public evidence snapshot change in the repository.
Production mutations were the email scheduler, backfill, curated listings and
categories, the test submission review and dismissed report/bookmark smoke.
No application source, deployment image or schema was changed in this task.
Targeted live checks above are the relevant runtime validation; no full local
test suite or build is required for these documentation changes.

Formatting checks passed for all eight changed documentation/evidence files;
`git diff --check` passed; 79 local links/anchors and the 20-listing/27-media
snapshot invariants passed. No unrun application tests are counted as passing.
