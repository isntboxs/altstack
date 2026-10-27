# AltStack Roadmap — Lean Releases

> Execution companion to [the PRD](prd.md). Reconciled on **2026-10-27** against
> `dev` at **`b4fe7ff`** and `main` at **`c15fd5d`**.
> Release contents, operator-reported rollout and recorded verification are
> tracked separately; unchecked operational items mean evidence is still missing.

The operator confirmed v0.4.0 production rollout in the project conversation on
2026-10-24. Older feature documents retain their branch verification and rollout
instructions; their pending-deployment statements are historical, superseded by
this baseline. Individual live-service outcomes are recorded separately in the
[2026-10-24 production verification](production-verification-v0.4.0.md).
The **2026-10-27 WIB recovery follow-up** configured private off-host backups,
proved an isolated restore, and exercised actual count pruning; see the
[recovery runbook](postgres-backup-restore.md).

## Release baseline and evidence

- **Current source checkpoint — 2026-10-27:** R6 and catalogue default-sort fixes already reached `main` through #121–#122. `dev` adds member/admin user management (#123), backup/restore evidence (#124), the admin workspace (#125) and layout/accessibility fixes (#126). Main-to-dev sync `b4fe7ff` preserves #122's tag/license defaults before rollout. The [rollout checkpoint](rollout-2026-10-27.md) records the next `dev` → `main` scope, target migration, validation and live acceptance gaps. No new release tag or matching deployed application revision is established here.
- **v0.2.0** (`0c75022`): project mentions/hover previews, sharing, footer and media fixes, on top of the existing catalogue, submission, SEO and Embed capabilities.
- **v0.3.0** (`bb30efe`): includes Bookmarks (#105), report intake (#108), admin report inbox (#109), revised R7 Featured Projects (#110), and related UI fixes. The operator confirmed rollout on **2026-10-22** in the project conversation. Production was not independently inspected in this reconciliation.
- **v0.4.0** (`b79593d`, release merge #119): includes the v0.3.0 baseline, Docker development/test databases (#112), GitHub Topics tags (#113), GitHub + Resend Magic Link and auth/rate-limit fixes (#115 and subsequent fixes), review-decision emails (#117), license discovery/archived metadata/ten sorts including observed seven-day Trending (#118), scoped-validation instructions and Vite+ 1.4.0. The operator confirmed production rollout on **2026-10-24**. Subsequent live inspection verified matching API/Web OCI revisions, 25 migrations, both jobs, delivery and 20 published listings; recovery gaps remain explicit in the [production record](production-verification-v0.4.0.md).

Feature documents retain their original branch test/QA results. Those historical
runs are not fresh checks of this checkpoint. The initial reconciliation changed
documents only; the linked production follow-up records authorized live changes.
Historical targeted review-email checks are recorded under R5c. P0 core
verification and the 2026-10-27 backup/restore drill are complete. Monitoring,
hardening, asset lifecycle and explicitly unexercised checks remain owned
follow-ups, not unimplemented product features or passing acceptance.

## Operating rules

1. Deliver vertical slices: schema/migration → API contract and authorization → UI → focused tests → deployable demo.
2. Target one focused outcome in 1–3 solo development days; split larger work before coding.
3. Reuse infrastructure unless an observed need justifies another dependency.
4. Keep migrations forward-only and additive.
5. Record implementation, tests, and operator rollout separately. Merged code is not deployment evidence.

## Current delivery status

- **R0 — Catalogue data:** schema and CSV/JSON importer implemented; 20 real published listings and their media/links verified in production on 2026-10-24.
- **R1 — Browse:** public list/detail implemented.
- **R2 — Find:** full-text search, filters, pagination, public category pages/admin taxonomy, GitHub Topics tags, license browsing, archived metadata and ten sorts including Trending are included in v0.4.0. See [licenses](licenses.md).
- **R3 — Sign in:** GitHub OAuth + Resend Magic Link, server-disabled password auth, shared dialog/route, session-aware navigation, route guards and API authorization included in v0.4.0; live login/return, inbox delivery and authenticated cross-subdomain requests verified in P0. Expiry/replay and initial bootstrap remain unexercised.
- **R4 — Submit intake:** authenticated minimal intake and private tracking implemented with `projects.status = 'draft'`.
- **R5 — Moderate + enrich:** admin review, publish validation, required rejection feedback, history, enrichment, and original-submitter resubmission implemented.
- **R5c — Review emails:** Published/Rejected decision outbox, bounded Resend retry and shared React Email templates included in v0.4.0; migration, every-minute scheduler, both decision mails and inbox links verified in P0.
- **L1 — SEO and link previews:** route metadata, structured data, indexing, sitemap, and static/dynamic social images implemented and merged.
- **L2 — Public UI:** branding, honest media/copy, accessible navigation, loading/recovery and link cleanup implemented. Embed, Bookmark and Report are functional; R6 enables Verify in source already merged to `main`; live R6 acceptance remains separate.
- **Project Embed:** public URL-controlled dialog and SVG badges implemented, including the designer-provided artwork; included in the released baseline, with domain/CDN acceptance evidence still separate.
- **Public content/media polish:** SSR Markdown/GFM, Shiki code blocks, project mentions/hover previews, cached-image decoding and stored-public-content preparation implemented and included in released code.
- **Private Bookmarks:** merged and included in v0.3.0 for all authenticated accounts, with published-only private storage and a three-column workspace table; see [rollout and validation](bookmarks.md).
- **Report intake and admin inbox:** merged and included in v0.3.0; guest/session-aware private intake and admin-only Open → Resolved/Dismissed moderation. See [reports](project-reports.md).
- **R7 — Featured Projects:** revised detail-page curation implemented and included in v0.3.0; R7 does not affect homepage ordering; R6 subsequently adds verified-first default ranking.
- **Development/test infrastructure:** separate local Docker PostgreSQL 18 databases, disposable test schemas, browser/HTTP acceptance tools and scoped validation policy implemented.
- **Additional delivered scope:** uploads, metadata prefill, README import, submission rate limiting, daily/manual GitHub refresh, observed star history with 90-date retention, and file seeding.
- **R6:** ownership/editing merged to `main` through #121; home ranking and category/tag/license defaults corrected in #122. Member management and protected admin user actions are merged to `dev` through #123. Login and submission provenance confer no ownership. See [ownership/member policy](project-ownership.md) and [account administration](auth.md#admin-user-management--2026-10-26).
- **Admin workspace:** overview, grouped navigation, submission/ownership queues, recorded activity and GitHub/outbox observations merged to `dev` through #125; layout and accessibility fixes followed in #126. No historical analytics, job execution controls or extra scheduler. See [admin workspace](admin-dashboard.md).
- **Recovery:** private daily R2 backups, isolated restore and actual count pruning verified on 2026-10-27 WIB; see [runbook](postgres-backup-restore.md). This does not establish application rollout or full incident-cutover readiness.

P0 core production verification and the backup/restore drill are complete.
**P1 is rollout and live acceptance of the implemented ownership/admin work**,
including the `dev` → `main` changes above. First ordinary daily-run evidence,
backup monitoring, storage credential scope and asset lifecycle remain owned
operational follow-ups. No release version is assigned by this checkpoint.
P2–P5 are conditional candidates in the execution order below.

## Ordered priorities after v0.4.0

This order is shared with the [PRD](prd.md#ordered-priorities-after-v040).
Priority reflects dependencies and the existing product journey; it does not
assert an active production incident or authorize changes to production.
Reuse recorded checks rather than rerunning historical acceptance by default.

### P0 — Close out v0.4.0 operations and catalogue quality

**Status: core production verification completed on 2026-10-24; backup and
isolated restore verified on 2026-10-27 WIB, with monitoring/hardening follow-ups.**
Working jobs, metadata, inbox delivery and the focused product
journey have recorded evidence. P1 is rollout/acceptance; do not queue
these completed checks again without a relevant change or failure.

**2026-10-24 outcome:** focused production checks passed. The missing email
schedule was enabled, GitHub backfill completed, and the catalogue grew from
7 to 20 verified listings. Backup/restore was open at that inspection; lifecycle inspection
and unexercised integrations are explicitly scoped in the
[production record](production-verification-v0.4.0.md).

Source: [Verifikasi Operasional Production Altstack](t3-thread://v1/456a157b-30fb-4bc9-afb6-e04106a4fd81).

- [x] Record operator-confirmed v0.4.0 rollout, tag `b79593d` and shipped scope.
- [x] Record target migration/configuration and matching API/web revision evidence: OCI revision `b79593d` on both containers, 25 migrations including review-email and license/archived, and runtime configuration.
- [x] Verify the every-minute review-email job and actual Published/Rejected mail to the operator account: enabled the missing schedule; 2 sent rows, one attempt each, no pending/failed/cancelled rows, provider delivery and operator inbox/link confirmations.
- [x] Verify the existing daily **02:00 Asia/Jakarta** GitHub job, topics/license backfill and refresh logs. Both the original 7/7 backfill and the final 20/20 catalogue run succeeded; established projects have 6–7 observed dates and newly curated projects begin with one real date.
- [x] Record focused live GitHub/Magic Link sign-in, submit → reject → email/private correction → resubmit → publish → email/public detail, and license/tag discovery. Bookmark/report smoke, CORS, anonymous 401 and explicit skipped integrations are in the [production record](production-verification-v0.4.0.md).
- [x] Verify **20 accurate published listings**, 20 logos + 7 screenshots, working official links and seven leaf categories. Record 119 public tags and honest GitHub license/empty-topic cases in the [catalogue snapshot](production-catalogue-v0.4.0.json).
- [x] Give confirmed failures outcomes, owners and next actions: email scheduling/backfill/content gaps fixed; recovery and lifecycle gaps assigned to the deployment/storage operator.
- [x] Configure private off-host PostgreSQL backups and prove an isolated restore. On 2026-10-27 WIB, enabled daily 03:00 WIB Dokploy backups to private R2 with 30-object retention. An off-host backup restored with 22/22 matching tables, 571 rows, 27 migration entries and passing integrity checks. Separate scheduled execution and real count pruning passed; see the [runbook and remaining operational gaps](postgres-backup-restore.md).

The first ordinary daily execution, backup failure/freshness alerting and
narrowing the existing application storage credential remain follow-ups.
The asset bucket's temporary-object lifecycle inspection from the earlier
403 remains separate and unverified; the new backup bucket's private access
and seven-day incomplete-multipart abort rule were verified live.

**Done when:** the focused release/service/content results and any follow-ups have
recorded outcomes/owners. Historical unchecked items alone do not block R6 or
reopen the confirmed rollout. The linked production record distinguishes executed
checks, live changes and remaining recovery/integration gaps.

Delivery/bounce webhooks and automatic outbox retention are unimplemented
reliability follow-ups. Select a focused slice if observed delivery failures or
retention requirements justify it; neither is a prerequisite for shipped review
mail, and neither introduces a new platform into P0.

### P1 — Roll out ownership and admin workflows

R6 is implemented under the 2026-10-24 user decision: project-contact
OTP plus independent approval, identical project-scoped Owner/Maintainer access,
immediate publication and verified-first default home ordering. The first
representative requires admin approval; subsequent claims require either existing
project role. Submission provenance and admin-only powers remain separate.

Ownership/editing and catalogue defaults are already in `main` (#121–#122).
Member/admin user management, recovery evidence and the admin workspace with
layout fixes are in `dev` (#123–#126), ready for the next main PR.

- [x] Implement scoped membership leave/role/revocation and protected admin user actions, including concurrency, ban and last-admin protection.
- [x] Implement admin overview, grouped workspace, submission/ownership queues, safe recorded activity and GitHub/outbox observations; preserve existing moderation and claim authorization.
- [x] Record private backup/restore/pruning evidence and remaining operational owners.
- [ ] Merge the current `dev` rollout to `main`; see the [checkpoint and acceptance plan](rollout-2026-10-27.md).
- [ ] Run the additive audit migration and separate post-commit validation on the intended target, then deploy matching API/Web revisions and record live acceptance. Check existing target migration history first; do not replay applied migrations or backfill owners.

Local feature evidence is tracked in [R6](#r6--own-and-edit),
[ownership notes](project-ownership.md), [auth](auth.md) and
[admin workspace](admin-dashboard.md). A source merge or PR does not establish
a production release, deployed revision or live provider/storage acceptance.

### P2 — Collections, then comparison

**Why later:** Bookmarks already cover basic saving. Proceed when returning users
need organized shortlists; confirm evaluation needs before comparison work.

- [ ] Define and implement a focused private named-collection slice on top of Bookmarks, with account-derived authorization and hidden/deleted-project handling. Public sharing is separate scope.
- [ ] Define useful comparison fields from real evaluation needs, then implement the smallest comparison journey; grouping alone does not validate a comparison feature.

**Done when selected:** users can organize saved projects and, for a separately
validated comparison slice, evaluate a shortlist without exposing private data.
Neither feature has an assigned release.

### P3 — Report workflow improvements

Proceed after report volume or operator feedback identifies a bottleneck. Select
the smallest useful improvement, such as reopen or follow-up; assignment,
comments, email and automated corrections require their own scope. Existing
intake and Open → Resolved/Dismissed decisions are delivered. Completion means
the selected bottleneck is resolved with private, authorized, auditable changes;
there is no scheduled expansion yet.

### P4 — Homepage editorial discovery

Proceed when catalogue coverage and browse feedback justify curated homepage
sections. Detail-page Featured and catalogue Trending sort already work. A
dedicated Trending/personalized feed requires separate scope and evidence.
Homepage editorial sections remain deferred; R6 separately adds verified-first default ranking. Completion of editorial discovery should
demonstrate a useful discovery journey rather than duplicate existing sorting.

### P5 — Demand-driven backlog

Guest submission, profiles/follows/reviews/ratings, galleries/video, newsletter/RSS,
historical/product analytics dashboards, scores, SDKs and extensions have no scheduled release.
The implemented admin overview and operational snapshots are current scope.
Meilisearch requires measured PostgreSQL search limitations. Select one observed
problem and define acceptance before implementation. Confirmed production failures
take precedence over this order; absent such evidence, do not promote deferred
features merely because they are listed.

## Repository conventions and validation

- Use one branch and one checklist per vertical slice, such as `feat/r5-resubmit`.
- Define oRPC contracts before handlers. API authorization is independent from route guards.
- Public list/detail/search/category/tag counts and existing sitemap queries select `published` on the server. Private bookmark state and report data stay outside public projections.
- Development uses Docker PostgreSQL 18 database `altstack` on loopback port 5432; tests use separate local `altstack_test` on port 5433. Test helpers require the local test target and never fall back to `DATABASE_URL`.
- Follow the root README's disposable-schema wrapper for database-dependent checks. It migrates a temporary schema in `altstack_test` without resetting development application data.
- Follow [AGENTS.md](../AGENTS.md#testing-scope): start with specific affected tests, expand only for concrete impact or failures, and state the reason before any justified full-suite run. Documentation-only changes need diff/link/format checks, not application tests.

```sh
vp install
# Example: scoped formatting for a documentation-only change.
vp fmt docs/roadmap.md docs/prd.md --check
# Example: one affected database-backed API feature, when code changes.
vp run db:test:start
vp run --filter @altstack/db test:scoped -- vp run --filter @altstack/api test tests/bookmark.test.ts
```

Choose lint/typecheck/build and HTTP/browser checks for the affected packages and
callers. Root `ready`, `vp run check` and unfiltered recursive/root tests are broad
commands, not routine completion steps. When a full-suite run is justified, use
`test:scoped` for database-backed work. The legacy category HTTP acceptance runner
uses `test:isolated`, which resets the Docker test database; keep it separate from
development data and prefer disposable-schema acceptance runners for new work.

### Historical reconciliation evidence — 2026-10-13

- `vp install`: passed, no dependency changes.
- `vp check`: format, lint, and typecheck passed.
- Scoped `vp test run`: **779 passed, 1 skipped** across 51 files, including server tests.
- Scoped `vp run -r test`: **777 passed, 1 skipped** across the shared/database/API/web workspaces; server has no package test script.
- The skipped case is opt-in real Upstash integration; mocked rate-limit tests passed.
- `vp run -r build`: passed. Web build reports large client chunks and dependency module-level directive warnings; include real mobile loading in L2 acceptance.
- Local documentation links and `git diff --check`: passed. Real OAuth/service smoke and production rollout remain unverified.

## Shared implementation decisions

### Lifecycle and authorization

- One `projects` table stores `submitterId`, nullable enrichment fields, and `rejectionReason`. There is no active `project_submission` table.
- `submission.create` atomically inserts a `draft` project, basic repository metadata, and `project_submitted` audit event. The UI labels the draft **Awaiting review**.
- `submission.list` derives the submitter from the session and returns only that user's projects, statuses, and rejection notes.
- Admin `admin.project.update` publishes, rejects, restores to draft, or unpublishes the existing project; publication does not create another listing.
- `removed` is a supported hidden status. `admin.project.remove` physically deletes the project and cascades repository/category/history, bookmark, Featured selection and tag-assignment rows. Audit and reports remain with their project FK set to null. Deletion is not a retained terminal submission record.
- Original submitters can correct only their rejected intake through `submission.getById` / `submission.resubmit` and a private Edit & Resubmit modal. Name/repository/website changes retain ID, slug, provenance, enrichment and media; state returns to draft and current feedback clears transactionally. Repeating create still returns `409` for existing repositories, including rejected ones.
- Private procedures require a session; admin project/category/upload procedures also require role `admin`.
- Bookmark procedures derive account identity from the session. Report intake permits guests; report reads/moderation, Featured selection and tag administration require admin role independently of route guards.
- Intake accepts GitHub and verified email Magic Link sessions. Password authentication is disabled on the server. Neither method grants repository ownership; see [auth](auth.md).

### Publish, audit, search, and GitHub

- Publish requires name, slug, canonical repository, tagline, description, logo, and **1–3 leaf categories**. Drafts can be incomplete.
- Intake suffixes colliding slugs numerically. Admin create/edit returns `409` for slug/repository conflicts or a concurrent edit.
- Audit covers create, update, remove, submit, and status change. Admin update writes `project_updated` plus `project_status_changed` when status or reason changes, transactionally. The original exactly-one-event moderation design is superseded.
- Rejection requires a trimmed, nonblank reason of at most 1000 characters in API and UI. Both admin create and the final merged PATCH state are checked before GitHub/media work. A PATCH may retain a valid stored reason but cannot clear it while remaining rejected. Legacy rejected records remain readable; restoring them clears the current note while audit history retains prior feedback.
- Homepage validates `q`, `category`, `sort`, and `page`; only these values are loader dependencies. Filter changes preserve other filters and reset pagination.
- Search uses PostgreSQL generated `tsvector` + GIN. Category filtering includes descendants; direct assignments use leaves in a maximum three-level hierarchy.
- Tags use GitHub Topics with immutable topic slugs and admin-curated labels/visibility. Project search supports a visible tag filter; `/tags/$slug` scopes the catalogue to that tag. Homepage URL state remains `q`, `category`, `sort`, `page`.
- Canonical URLs and GitHub-resolved identity constraints protect duplicates. A service token validates public data, not maintainer ownership.
- Public statistics read DB snapshots. Refresh stores stars/forks, last commit, repository creation, latest release, and fetch timestamps. History uses actual observations. License browsing adds the user-approved seven-day observed star-delta Trending sort; it does not reconstruct history.

---

## R0 — Catalogue data

**Outcome:** enough accurate content to make browsing useful.

- [x] Project/repository/category/path/assignment/audit schemas, migrations, and canonical uniqueness.
- [x] CSV/JSON importer with dry-run, validation, transactional writes, idempotent skipping, and optional GitHub statistics/README fetch.
- [x] Parser, importer, CLI, migration, and concurrency tests.
- [x] Import/review at least **20 real published projects** with correct copy, logo, links, and leaf categories; verified in [production on 2026-10-24](production-verification-v0.4.0.md#catalogue-7--20-published-listings).
- [x] Verify target migration journal: 25 entries applied, including all v0.4.0 additions; see [deployment evidence](production-verification-v0.4.0.md#deployment-and-migrations).
- [ ] Repeat-import idempotency against the target remains unexercised; production curation used admin APIs, not a file import. This is not an outstanding catalogue-count check.
- [x] Verify real metadata/media: 20 listings, 20 logos and 7 screenshots passed in the [production record](production-verification-v0.4.0.md). Committed `data/projects.*` files remain example templates, not production evidence.

Evidence: [file-seeding guide](file-seeding.md), `packages/db/src/seed-file-*.ts`,
and `packages/db/tests/seed-file-*.test.ts`. The demo seed has been removed.

## R1 — Browse

**Outcome:** visitors discover published projects without signing in.

- [x] `project.list` / `project.getBySlug`, pagination, published-only visibility, and generic not-found behavior.
- [x] Homepage grid and `/$slug` detail with identity, links, Markdown, categories, optional screenshot, and GitHub statistics.
- [x] Empty states, safe optional website handling, and API/UI visibility/statistics coverage.
- [x] Complete focused production browse/detail/mobile smoke with real content/storage; 20 detail pages and 27 media assets passed. See [production journeys](production-verification-v0.4.0.md).

Evidence: `packages/api/src/routers/project.ts`, `apps/web/src/routes/_app/`,
`packages/api/tests/submission-review.test.ts`, and web GitHub statistics tests.

## R2 — Find and taxonomy

**Outcome:** visitors narrow the catalogue and share the exact result.

- [x] Full-text search; newest, oldest, name, most-stars, and most-forks sorts.
- [x] Debounced search, filters, validated URL state, empty/reset/pagination states.
- [x] Hierarchy/subtree filtering, published-only counts, `/categories` and nested category pages, breadcrumbs, canonical metadata, and historical-path redirects.
- [x] Admin category CRUD at `/admin/categories` with depth/cycle/leaf/path integrity.
- [x] GitHub Topics sync, `/tags` directory, `/tags/$slug` published catalogue, detail tag links and `/admin/tags` curation. See [tags](tags.md); included in v0.4.0.
- [x] License directory/scoped catalogue, archived metadata and ten catalogue sorts including observed seven-day Trending; included in v0.4.0. See [licenses](licenses.md).
- [x] API/model/route/form/catalogue UI tests; category HTTP acceptance script exists.
- [x] Verify shared filter URLs, detail reload, back/forward and combined filters in production; see [production journeys](production-verification-v0.4.0.md). Historical-category redirect acceptance was not separately exercised.
- [ ] Exercise historical-category redirects on the target when that acceptance scenario is selected.
- [ ] Record EXPLAIN/index evidence on a representative dataset; a declared index alone does not prove performance.

Evidence: project/category/admin-category routers, web category features/tests,
and [admin category API notes](category-admin-api.md).

## R3 — Sign in

**Outcome:** developers establish sessions for private submission workflows.

- [x] Better Auth GitHub OAuth + Resend Magic Link, server password rejection, shared auth dialog/route, sign-in/out and session-aware navigation.
- [x] Hashed ten-minute single-use links, React Email delivery, persistent PostgreSQL IP/recipient quotas and safe callbacks. Better Auth/Drizzle adapter are aligned at 1.7.12 with row-lock contention regression coverage; see [auth](auth.md).
- [x] Private layout and submit guards, sanitized local return URL, independent API checks, private `/submission`, and role-specific navigation.
- [x] Verify real GitHub login/callback/return and Magic Link sign-in with authenticated requests and anonymous private-route redirect; see [production record](production-verification-v0.4.0.md).
- [ ] Exercise forced session expiry/logout and Magic Link expiry/replay separately; these were not forced in P0.
- [x] Support intake for GitHub and verified email Magic Link users under the authorized auth policy; R6 ownership/claims are merged to `main`, with live target acceptance still unverified here.
- [x] Verify live Resend/Magic Link delivery, successful sign-in and cross-subdomain authenticated requests; operator inbox confirmation is in the [production record](production-verification-v0.4.0.md).
- [x] Verify the existing GitHub OAuth callback and return to `/submission` in production.
- [ ] Verify initial admin provisioning separately; an existing admin account was used in P0.

Evidence: `packages/auth/src/server/config.ts`, API procedures, auth/main routes,
and `apps/web/src/utils/return-to.ts`.

## R4 — Submit intake

**Outcome:** signed-in users suggest repositories without publishing them.

- [x] Name + repository + optional HTTP(S) website; canonicalization, public GitHub verification, alias/duplicate checks, slug suffixes, atomic draft/metadata/audit creation.
- [x] Protected `/submit`, confirmation, searchable/paginated private `/submission`.
- [x] Shared create/resubmit Upstash quota: five validated attempts per ten minutes/account; race-safe ten-open-draft cap.
- [x] Typed `429` data and RPC/REST headers; editable form/countdown, no automatic retry, Redis failure stops creation.
- [x] Tests for authorization, identity/races/capacity, rollback, visibility, quota, and cooldown.
- [x] Exercise real configured Upstash during live submission/resubmission/report operations without service failure; see [production record](production-verification-v0.4.0.md). Quota/capacity exhaustion was not forced, and the opt-in automated integration remains separate.

Evidence: submission router/rate limiter, web submission features, and
[rate-limit operations](../README.md#submission-rate-limit).

## R5 — Moderate, enrich, and launch

**Outcome:** admins publish complete listings; submitters can act on feedback.

### Implemented

- [x] Admin list/create/edit at `/projects`, `/projects/create`, `/projects/$id/edit`; status and Needs Review filters, submitter identity.
- [x] Save draft, publish complete merged state, reject, restore, unpublish, and delete with admin API authorization.
- [x] Fresh basic GitHub verification on publish/repository changes, category validation, concurrent-edit checks, and transactional persistence.
- [x] Update/status audit events, paginated review history, catalog invalidation, private rejection-note display, and focused tests.

### R5a — Actionable rejection feedback

- [x] Require nonblank feedback in the server's final rejected state and admin UI, including direct API calls.
- [x] Keep feedback private and preserve previous reasons in audit history on restoration, including initially rejected admin-created projects.
- [x] Cover reject without reason, valid reject, restore, and stale/concurrent updates. Do not invent reasons for legacy records.

**Done when:** every new rejection has actionable feedback in `/submission`.

The review form shows inline feedback for an empty Reject and keeps draft/restore
actions available after validation fails. No migration or legacy backfill is needed.

Focused verification: shared schema/submission tests **82 passed**; scoped API
submission/create-update/history tests **98 passed**; review form/history UI
tests **18 passed**; OpenAPI/HTTP codec tests **66 passed**. The create contract
now declares optional nullable feedback; runtime validation requires it whenever
the final status is rejected.

Final validation on 2026-10-14: `vp check` passed; disposable-schema root
`vp test run` passed **828 tests, 1 skipped** across 52 files; `vp run -r build`
passed with existing chunk-size/dependency directive warnings. The skipped case
is opt-in real Upstash integration. Deployment/service smoke remains separate.

### R5b — Correct and resubmit

- [x] Protected original-submitter rejected-intake read/resubmit contracts and accessible private Edit & Resubmit modal.
- [x] Only name/repository/website edits; session-derived authorization, public GitHub verification, canonical aliases/resolved identity and conflicts checked before writes.
- [x] Atomic `rejected` → `draft`, current reason cleared, same ID/slug/provenance/enriched copy/media/categories retained, submitter transition audit with previous feedback; old audit events preserved.
- [x] Shared five-attempt/ten-minute Upstash quota and ten-open-draft account lock; owner/status/client revision rechecked under a project row lock after external fetch. Intake repository-ID lock protects concurrent rename/alias identity conflicts.
- [x] Foreign/missing records concealed with `404`; no session `401`; wrong state or stale revision `409`, including admins as submitters. Published editing and claims stay in R6.
- [x] Schema/API/RPC/REST/OpenAPI/UI coverage for privacy, allowed fields, provenance/audit, duplicates, identity/history, quota/cap races, GitHub/Redis failures, rollback, concurrent admin decisions, correction/countdown and in-place navigation.

**Done when:** submitters correct rejected intake and re-enter review without
another listing or an admin restoration.

Repository policy: preserve snapshots/history for the same GitHub ID across
rename/transfer; clear unrelated metadata/history for a different or unknown
previous identity. No synthetic history or media work. Slug stays unchanged.
See [resubmission contract and policy](submission-resubmit.md), submission router,
`packages/api/tests/submission-resubmit.test.ts`, and web resubmit/route tests.

**Verification record:** the branch results above are historical evidence, not
fresh verification of v0.4.0. Record affected-feature checks and justified integration
checks against the actual release revision under the current testing policy.
The [production record](production-verification-v0.4.0.md) now establishes real
OAuth/Upstash and reject → correct → resubmit → publish with decision-email
delivery. Its focused scope does not imply every historical acceptance check ran.

### R5c — Submission decision email

- [x] Notify the stored original submitter on actual Published/Rejected transitions; skip records without a recipient, unchanged saves and feedback-only edits.
- [x] Commit an outbox row with its status audit UUID; no mail before commit, rollback/stale-write protection, separate identities for resubmission/re-review.
- [x] Reuse Resend and existing private `/submission` → sign-in → Edit & Resubmit. Public links use `/$slug`; feedback remains private, escaped text.
- [x] Consolidate all React Email components in `packages/ui/src/emails` with shared brand layout/primitives and explicit exports. Preserve Magic Link HTML/text, ten-minute expiry and one-use copy.
- [x] Add the private scheduled server CLI, frozen payloads, concurrent-worker leases, eight-attempt/23-hour retry limits and synthetic HTML/text previews.
- [x] Record target outbox migration, runtime `EMAIL_APP_URL`, matching Web/API revisions and every-minute job evidence under P0; see [production verification](production-verification-v0.4.0.md#review-emails-repaired-and-exercised).
- [ ] Complete the mail-client matrix and bounce acceptance; live Published/Rejected delivery and operator inbox/link checks passed on 2026-10-24, but these additional integrations were not exercised.

Historical local evidence on 2026-10-23: 146 scoped API review/resubmit/history/notification
tests, 44 auth, 23 web journey/sign-in, 8 shared email, 5 CLI and 1 additive migration
test passed. Scoped formatting/typed lint/typechecks, affected package builds and
web production build passed; T3 visual inspection covered desktop/360 px, long
feedback and hidden images. See [delivery/rollout limits](review-notifications.md)
and [rendered previews and exact verification scope](email-previews/README.md).
No real email, production migration, deployment or live scheduler was run during
that feature-branch verification. Review emails are now included in the
operator-confirmed v0.4.0 rollout; individual live outcomes remain P0 evidence.

## Delivered scope beyond the initial plan

- [x] **Admin media:** logo/screenshot upload, crop, temporary-to-final promotion, replacement, and cleanup through S3-compatible storage.
- [x] **Metadata prefill:** preview/apply GitHub description and website without automatically saving.
- [x] **README import:** pinned sanitized Markdown, BlockNote preview, explicit replace/append, stale-request protection, Save-only persistence. See [README import](github-readme-import.md).
- [x] **Statistics refresh:** shared admin POST and daily sequential CLI, batch lock, best-effort enrichment, rate-limit stop, identity/concurrency protection.
- [x] **Star history:** additive migration, daily WIB observations, honest cold-start/gap/staleness states, detail chart/comparison, repository-ID continuity, and 90-date retention. v0.4.0 additionally delivers observed seven-day Trending sort; broader feeds/rankings remain deferred.
- [x] **CSV/JSON seeding:** replaces demo seed; categories/projects/relationships, optional GitHub enrichment, dry-run, repeat imports.
- [x] **Project activity:** public `/activity` displays recent commits from the AltStack repository.
- [x] Record matching revision/migration journal evidence, inspect refresh/history points, and verify the existing daily **02:00 Asia/Jakarta** schedule under P0. See the [production record](production-verification-v0.4.0.md#github-schedule-and-backfill) and [rollout guide](github-statistics-refresh.md).

These implementations do not prove production service/schedule configuration.

## Delivered public-release slices

R5a/R5b, L1/L2, Embed, public content, Bookmarks, Reports and revised R7 are
implemented in released code. The dated verification below is retained as
history; it does not put v0.4.0 back into pre-launch status. Outstanding live
checks are tracked under operations evidence.

### L1 — Catalogue SEO and link previews

**Implemented and merged at `a650dd0`:** route-specific SEO/GEO and static/dynamic social cards.
The baseline root already used the configured app name and deployed icons;
the earlier starter-title diagnosis was stale. Release-domain/social-crawler
acceptance remains separate from implementation.

- [x] AltStack defaults and per-project title/description/canonical from published loader data.
- [x] Complete OG/Twitter metadata, committed deterministic 1200 × 630 default PNG and content-specific project/category PNG endpoints using the approved brandkit and local Inter.
- [x] Project cards include trusted public logos, stored GitHub stars/forks and snapshot dates, with bounded raster decoding, missing-logo fallbacks and content-sensitive cache revisions.
- [x] Live sitemap index with bounded published-project shards and current public category paths; exclude private/admin routes and query permutations.
- [x] Explicit private/auth/admin, filtered/paginated and empty-category indexing policy; configured-origin robots sitemap discovery and crawlable OG endpoints. API authorization remains the access boundary.
- [x] Safe truthful JSON-LD and crawler-readable project Markdown in SSR. The public renderer was subsequently replaced as recorded below; BlockNote remains the admin editor.
- [x] Verify real SSR HTTP metadata, missing/nonpublic detail, canonical redirects, image updates/unpublish, offline resource packaging and cold Node/Nitro runtime.

Implementation/regeneration, indexing/cache policy, actual verification and
remaining release checks: [L1 notes](seo-og.md). Images are generated locally
with a pinned Node-compatible `@vercel/og`; no hosted image service is required.

### L2 — Finish public UI affordances

- [x] Original L2 scope retained disabled Verify/Bookmark/Report/Embed and account Bookmarks with accessible “Coming soon” labels. Subsequent slices enabled Embed, Bookmark and Report; R6 enables Verify in source already merged to `main`.
- [x] AltStack branding, icons and manifest copy replace starter identity.
- [x] Replace generic screenshot placeholders with honest empty states.
- [x] Give the hero's Explore Projects a working catalogue destination, make the Introducing badge noninteractive, and remove unsupported compare/trending copy.
- [x] Handle failed screenshots/logos, accessible menu names/focus, long mobile layouts, and usable loader/error recovery.
- [x] Verify local keyboard/mobile browser navigation, loading/error/not-found states, images and external destinations; native devices/services remain release gates.

**Implemented and merged at `b83b448` on 2026-10-16.** The implementation thread
reported passing check/build, **952 root tests**, **950 workspace tests** and
five desktop/mobile browser scenarios on branch revision `357d536`; both test
suites skipped the opt-in Upstash integration. These are branch verification
results; merged-revision checks remain separate.
No deferred workflow was enabled by that original L2 slice. Historical research
and local evidence artifacts have been removed from the repository.

**Done when:** every enabled action works and public copy matches the product.

The implementation followed the 2026-10-15 reference research and the user's
decision to retain disabled controls. R6 now supplies the Verify workflow.
Bookmarks and the report inbox are separately implemented below after v0.2.0.
Release/staging acceptance remains a separate gate.

### Public project Embed — 2026-10-17

**Implemented and merged at `d49273a`.** Final artwork comes from
`apps/web/public/badge.svg`, bundled by the generator with dark/light variants
and proportional custom sizing.

- [x] Original Embed slice enabled Embed on desktop and More; subsequent slices also enabled Bookmark and Report, R6 subsequently enables Verify in source already merged to `main`.
- [x] URL-controlled accessible dialog, dark 200 × 50 defaults, bounded editable
      dimensions, actual SVG preview and escaped HTML with honest clipboard feedback.
- [x] Public SVG generator with approved AltStack signature, live published-only
      visibility, generic errors and no-store / cross-origin embedding policy.
- [x] Focused validation, route/history, UI, endpoint and production HTTP tests.
- [x] Branch verification: `vp install`, `vp check` (zero warnings/errors),
      disposable-schema root suite **992 passed / 1 skipped** across 61 files,
      `vp run -r build` **8/8 tasks**, and **14** cold production HTTP acceptance groups.
- [x] T3 browser QA at 1440 × 900, 320 × 568 and 390 × 844: direct/reload/history,
      keyboard/focus/Escape/outside, validation/Copy failure, both themes and copied
      HTML embedded on another origin. Dialog navigation preserved scroll and heading
      identity with **zero project RPC refetches and zero new skeletons**.

- [ ] Verify the merged release revision and deployment domain/CDN behavior.

Tested on `feat/project-embed` from `46a1e0f` plus the uncommitted source/test tree
fingerprint `8e29732b01051a149865f3c8515ff611fd0844087d6286c02f888b00be29efb6`.
The skipped case is opt-in real Upstash integration. Existing dependency directive
and large-chunk build warnings remain; no new dependency or migration was added.
See the focused guide for fingerprint definition and evidence locations.

The later designer-artwork update, committed as `eb8df63`, separately passed
**33 focused tests**, **8/8 build tasks** and **14 HTTP acceptance groups**, with
dark/light visual checks. The 992-test full-suite result above predates this
artwork update; it is not verification of the final merged revision.

See [Embed parameters, lifecycle and rollout](project-embed.md). L2's historical
all-disabled decision was superseded for Embed by this slice, and later for
Bookmark and Report by their own implementations.

### Public content and media polish — 2026-10-18

Present in `dev` at `840f1fd`, following the Markdown renderer merge `8128e0f`.

- [x] Render public documentation with `react-markdown`/GFM in SSR and hydration, omitting raw HTML; retain BlockNote for admin editing/import preview.
- [x] Server-prepared Shiki light/dark code tokens, source-preserving Copy feedback and plain-code fallback; explicit internal project links can show published project mentions.
- [x] Accept only a validated slug for content preparation. Read stored content and mention metadata using published-only queries with the repository row required by public detail; never accept Markdown from the caller.
- [x] Use completed images' `decode()` promises for logo/screenshot success and failure states, retaining local fallbacks and source-change resets.

The implementation thread reported `vp check`, **109 regression tests**,
**16 production HTTP acceptance groups** and **8/8 build tasks** passing for
the fixes committed as `840f1fd`. These focused results do not replace a full
release-revision suite or staging/production acceptance.

### Launch acceptance and operations

This checklist retains historical acceptance gaps and supports P0; it is not a
new pre-launch gate. Attach existing evidence first, verify the relevant v0.4.0
changes and investigate confirmed failures. Unchecked rows mean missing records,
not proof that migration, configuration or deployment has not happened.

- [x] Record operator-confirmed v0.3.0 rollout on 2026-10-22; its tag contains Bookmarks, Reports/inbox and revised R7. This does not certify every service check below.
- [x] Record operator-confirmed v0.4.0 production rollout on 2026-10-24 at `b79593d`; shipped scope is recorded in the release baseline.
- [x] Resolve intake policy: authenticated GitHub and verified email Magic Link sessions are supported; password authentication is disabled. Magic Link is included in v0.4.0.
- [x] Record focused R5a/R5b reject → correct/resubmit → publish live acceptance with both decision mails in the [production record](production-verification-v0.4.0.md).
- [ ] Complete L1 social-crawler cache acceptance; public metadata/OG/sitemap HTTP evidence already exists in the production record.
- [x] Verify at least 20 accurate published listings and real media/links; [2026-10-24 production evidence](production-verification-v0.4.0.md#catalogue-7--20-published-listings).
- [x] Attach affected-feature validation for the current source rollout: 368 scoped tests across 20 files, typechecks, scoped lint/format, API/Server/Web builds and documentation checks. The [checkpoint](rollout-2026-10-27.md#checkpoint-validation) records revisions, the corrected stale navigation expectation, interrupted worker attempts and unrun live acceptance; no full suite is claimed.
- [x] Record focused production browse/search/categories/tags/licenses/Trending, GitHub/Magic Link, submit → reject → email/correct/resubmit → publish → email/public detail, bookmark and report → dismiss smoke; existing Featured selections were served. See [production record](production-verification-v0.4.0.md).
- [ ] Exercise Featured selection editing separately; serving the existing selection does not establish that its admin editor was retested live.
- [x] Record anonymous private API `401`, draft/rejected public `404`, real CORS and authenticated cross-subdomain requests in the production record.
- [ ] Exercise non-admin `403`, removed detail, quota/capacity exhaustion and forced session expiry on the target; do not infer these from the narrower live checks.
- [x] Document Docker dev/test separation and current auth/Resend/proxy/cookie configuration in the root README and [auth guide](auth.md).
- [x] Record real OAuth callback/CORS, media public URL reads/uploads and configured Upstash use in the production record without credentials.
- [ ] Verify initial admin bootstrap and inspect the asset temporary-object lifecycle with suitable operator access.
- [x] Record v0.4.0 migration execution and matching API/Web revision, rollback/forward-fix notes, and the later private backup/restore proof. See the [production record](production-verification-v0.4.0.md) and [recovery runbook](postgres-backup-restore.md).
- [ ] Record migration/constraint validation and matching API/Web revisions for the [current rollout](rollout-2026-10-27.md); historical v0.4.0 evidence does not establish this revision.
- [x] Record v0.4.0 tags migration `20261022111024_github-topic-tags`, topics backfill and existing daily sync evidence; [production record](production-verification-v0.4.0.md#github-schedule-and-backfill). No second GitHub scheduler was added.
- [x] Record v0.4.0 auth migrations, server-only email configuration and focused delivery/GitHub/cross-subdomain session evidence in the production record. See [auth](auth.md).
- [ ] Exercise Magic Link replay/expiry and verify deployed proxy header handling separately; configured values and successful sign-in do not establish those cases.
- [x] Record v0.4.0 review-email migration `20261023074640_submission-review-notifications`, `EMAIL_APP_URL`, every-minute job and live mail evidence; [production record](production-verification-v0.4.0.md#review-emails-repaired-and-exercised).
- [x] Record v0.4.0 license/archived migration `20261023175513_github-license-archived`, existing-job backfill and daily sync evidence; [production record](production-verification-v0.4.0.md#github-schedule-and-backfill).
- [x] Inspect statistics CLI, real history points, daily schedule, and failure logs; backfill 7/7 and final catalogue refresh 20/20 passed. A full 30-day history is not a launch blocker.

Keep evidence gaps open until execution is recorded. The earlier feature-branch
docs' statements that no deploy/merge occurred describe those test runs; the
release baseline above supersedes them for merge and operator rollout status.

## R6 — Own and edit

**R6a/R6b merged to `main` through #121; catalogue defaults corrected in #122.
Member management is merged to `dev` through #123. Live rollout acceptance remains
unverified by this checkpoint.** The
2026-10-24 user decision replaces the previous GitHub-only claim policy.

### R6a — Claim / Verify

- [x] Two-field email/role dialog at `?dialog=verify`, auth handoff, OTP confirmation, expiry/resend/error/pending states and URL history.
- [x] Contact OTP plus independent approval: admin for the first representative, then either project role for additional claims. No automatic ownership from email or submission alone.
- [x] User-approved GitHub evidence follow-up: claimant account linking, permissions before code issuance and fresh approval checks; read-only denial, independent notes for write/unavailable evidence, private proof migration and no extra repository write scope.
- [x] Additive claim/membership/upload tables, separate from `submitterId`; bound hashed short-lived single-use codes, persistent quotas and serialized claim decisions.
- [x] Better Auth owner/maintainer roles with identical capabilities restricted to approved memberships; admin role preserved.
- [x] Public verified badge from active representatives, hidden Verify after approval, Request access for additional representatives, default home verified-first then GitHub stars/ID; category/tag/license default: Most stars. Explicit alternative sorts preserved. No billing scope.
- [ ] Apply migration and matching API/Web revisions on the intended target; validate controlled-inbox delivery and real reviewer workflow.

### R6b — Maintainer editing

- [x] `/managed` and per-project editor for immediate publication of copy, website, content, media and 1–3 leaf categories; private approval inbox.
- [x] Direct API membership checks, publication validation, stale-write protection, audit and account/project-bound temporary uploads.
- [x] Preserve admin moderation/deletion, repository identity, taxonomy, Featured and report permissions. Changing to a different repository identity clears memberships and pending claims.
- [ ] Complete target acceptance after rollout; local validation is recorded in [feature notes](project-ownership.md).

### Member and admin user management follow-up — 2026-10-26

- [x] Member lists linked from My projects and the project editor, including self-service leave for hidden listings; admin-only project role changes and revocation of another account.
- [x] Equal owner/maintainer edit/review permissions retained; self-escalation and unrelated-project access rejected; returning after revocation requires fresh proof and independent approval.
- [x] Revision checks and project/account locks cover competing membership changes, fresh-evidence approval and media promotion; the last active representative's departure removes verification and returns claims to admin review.
- [x] Protected `/admin/users` search/filter/pagination and user detail with safe account/provider/session summaries, membership navigation, role assignment, ban/unban and revoke-all-sessions through Better Auth.
- [x] Last-active-admin protection, concurrent actor rechecks, self-ban denial, atomic audit/session changes and blocked native HTTP bypasses. Destructive account deletion/impersonation and credential/email changes are excluded.
- [x] Additive audit-only migration; no ownership or account-data backfill. See [member policy](project-ownership.md#member-management-follow-up--2026-10-26) and [auth](auth.md#admin-user-management--2026-10-26).
- [ ] Apply the migration, run deferred audit constraint validation after commit, and deploy matching app revisions on the intended target; complete live provider/mail/storage acceptance. No production rollout is claimed.

## R7 — Featured Projects on detail pages

User-revised scope on **2026-10-22**: keep the homepage unchanged and curate a
global Featured Projects icon panel on public project detail pages.
Merged via #110 (`02bfe55`) and included in the operator-reported v0.3.0 rollout.

- [x] Admin-only `/admin/featured`, search/add/remove/order and explicit save, bounded to 21 projects with concurrent-save protection.
- [x] Additive selection table; public reads require published status, repository data and a valid website, exclude the current project, and expose only preview fields.
- [x] Sidebar panel below stats on two-column layouts; stats scroll away and Featured sticks below the header until the sidebar ends.
- [x] Mobile panel after Copy link/Share buttons without sticky positioning; direct external website links and existing Markdown mention hover previews.
- [x] Empty selections omit the panel and preserve the existing stats sticky behavior. Homepage sorting and content are unchanged.
- [ ] Attach target migration and domain/browser acceptance evidence to the rollout record; do not infer it from branch QA.

See [behavior, concurrency, migration and verification](featured-projects.md).
Homepage editorial sections (P4), dedicated Trending/personalized feeds and scores
remain deferred. The catalogue Trending sort is delivered in v0.4.0.

## Private Bookmarks — 2026-10-21

Merged via #105 (`6753d8a`) and included in the operator-reported v0.3.0 rollout.
All authenticated users/admins can save/remove published projects, with private
persistent bookmarks, desktop/compact/mobile actions, account/sidebar navigation,
and protected `/bookmarks` containing only Name, Description (tagline), and one
Remove action. Published-only ownership checks, pagination, pending/error/empty
states, additive migration, and DB/API/UI/HTTP coverage are included.
See [Bookmarks behavior, rollout and validation](bookmarks.md). Collections and
comparisons remain out of scope.

## Admin report inbox — 2026-10-21

Intake merged via #108 (`9d404c2`); the inbox merged via #109 (`dc447b8`),
including the cached-page refresh fix. Both are included in the operator-reported
v0.3.0 rollout. Target migration and live acceptance evidence remain separate.

- [x] Admin sidebar and guarded `/admin/reports`, reusing the admin table components; email/type/message/date/status and existing project editor navigation.
- [x] Admin-only RPC/REST list and moderation, 401/403 before data access, Open → Resolved/Dismissed with atomic concurrent-decision protection.
- [x] Default Open/newest-first, bounded cursor pagination, status filters, pending/error/empty states and invalidation after decisions.
- [x] Additive status/default/index migration preserves old intake; nullable project FK retains future deleted-project reports without broken editor links. Unpublished targets remain editable.
- [x] Shared/API/DB/UI/HTTP coverage for privacy, defaults, migration preservation, concurrent/invalid decisions, pagination, plain text and editor targets.

See [behavior, rollout and verification](project-reports.md). Automatic changes,
assignment/comments/email and reopen workflows remain outside this slice.

## GitHub Topics tags — included in v0.4.0

Merged via #113 (`f023003`); implementation includes its review fixes and is
included in the operator-confirmed v0.4.0 rollout.

- [x] `tags` / `project_tags`, immutable lowercase topic slugs, transactional sync during submission/resubmit/admin repository changes, manual/daily refresh and opt-in GitHub file import.
- [x] Admin `/admin/tags` create/search/edit/hide/unhide/delete; sync preserves display-name/description/hidden curation and deletion is restricted while any assignments remain.
- [x] Public `/tags` with search, alphabetical filtering, popular/name sorting and pagination; `/tags/$slug` published-project catalogue and project detail tag links.
- [x] Hidden/unknown/empty-public tags do not expose a public tag page; counts require published projects with repository rows. Topics are unrelated to GitHub release tags.
- [x] Record target migration, initial topics backfill and focused production acceptance in the [2026-10-24 record](production-verification-v0.4.0.md). The existing GitHub refresh job performs backfill; no new GitHub scheduler was added.

Evidence: [tags behavior/rollout](tags.md), `packages/db/src/tags.ts`,
`packages/api/src/routers/tag.ts`, `packages/api/tests/tags.test.ts` and web tag routes.

## Admin workspace — merged to dev on 2026-10-27

The admin overview, grouped workspace navigation, submission/ownership queues,
recorded activity feed, and operational observations are implemented through
#125, with layout/accessibility fixes in #126. Current snapshots and the safe
audit feed use admin-only API reads; no additional migration or scheduler is
needed for this slice. See
[admin workspace](admin-dashboard.md) for routes, privacy,
validation, and telemetry limits. Production rollout is not claimed; analytics
and historical trend dashboards remain separate backlog items. The next main
PR and target acceptance are tracked in the [rollout checkpoint](rollout-2026-10-27.md).

## Later, only when justified

Use the [ordered priorities](#ordered-priorities-after-v040) rather than treating
this backlog as a committed feature list:

- **P2:** private collections → separately validated comparison.
- **P3:** the smallest report workflow improvement justified by operator evidence.
- **P4:** homepage editorial sections after catalogue/browse feedback; dedicated Trending/personalized feeds remain separate from the delivered sort.
- **P5:** guest project submission when sign-in blocks legitimate intake; profiles/follows/reviews/ratings, galleries/video, scores, analytics, newsletter/RSS, SDKs and extensions after feedback. Anonymous report submission already works.
- **Evidence-dependent infrastructure:** Meilisearch only for measured PostgreSQL limitations; GitHub/email webhooks and outbox retention only for a demonstrated freshness, delivery or retention need. Existing refresh and mail CLIs remain the baseline.

## Release close-out template

- Shipped scope, commit, deployment version.
- Deferred work and skipped checks.
- Migration and rollback/forward-fix notes.
- Test commands/results and manual smoke evidence.
- Operator status, limitations, observed need for the next slice.

## License browsing and archived metadata — included in v0.4.0

Merged via #118 (`08bb687`) and included in release tag `v0.4.0` (`b79593d`),
whose production rollout was operator-confirmed on 2026-10-24.

- [x] Additive nullable license identity/name/slug/document URL and archived metadata; shared normalization against the vendored full SPDX identifier list.
- [x] Initial intake/resubmit/admin/import and existing manual/daily GitHub refresh paths; failed fetch preservation and repository-ID continuity.
- [x] `/licenses` published-only directory/counts and `/licenses/$slug` scoped search/sort/pagination; unknown/filter/not-found/error states, canonical/noindex and sitemap policy.
- [x] Internal discovery links, public navigation/footer, card Stars → Last commit → License and Archived badge; detail License immediately above Repository with a separate human document link.
- [x] Ten requested sorts, preserving legacy query values. User selected Most popular = total stars; Trending = observed seven-day star delta, insufficient observations last. No ranking decision remains open.
- [x] Record `20261023175513_github-license-archived`, matching API/web revisions, existing-job backfill and daily synchronization/live GitHub metadata evidence under P0; [production verification](production-verification-v0.4.0.md).

Focused checks, reproducible commands, browser evidence and rollout limits:
[license feature notes](licenses.md). No R6, collections or compare work is included.
