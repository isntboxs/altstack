# AltStack Roadmap — Lean Releases

> Execution companion to [the PRD](prd.md). Reconciled on **2026-10-13** against
> baseline commit `f876eb1`. Checked items mean implemented in this checkout,
> not deployed or verified in production. Open acceptance/rollout items remain
> release gates.

R5a implementation updated on **2026-10-14** from baseline `8127d34`.
R5b implementation updated on **2026-10-14** from baseline `4adb6b6`.
L1 implementation merged into `dev` at **`a650dd0`**, reconciled on **2026-10-15**.
Merged-revision and production acceptance remain open.

## Operating rules

1. Deliver vertical slices: schema/migration → API contract and authorization → UI → focused tests → deployable demo.
2. Target one focused outcome in 1–3 solo development days; split larger work before coding.
3. Reuse infrastructure unless an observed need justifies another dependency.
4. Keep migrations forward-only and additive.
5. Record implementation, tests, and operator rollout separately. Merged code is not deployment evidence.

## Current delivery status

- **R0 — Catalogue data:** schema and CSV/JSON importer implemented; real launch content needs verification.
- **R1 — Browse:** public list/detail implemented.
- **R2 — Find:** full-text search, filters, sorting, pagination, public category pages, and admin taxonomy implemented.
- **R3 — Sign in:** OAuth configuration, session-aware navigation, private route guards, and API authorization implemented; real OAuth smoke remains open.
- **R4 — Submit intake:** authenticated minimal intake and private tracking implemented with `projects.status = 'draft'`.
- **R5 — Moderate + enrich:** admin review, publish validation, required rejection feedback, history, enrichment, and original-submitter resubmission implemented.
- **L1 — SEO and link previews:** route metadata, structured data, indexing, sitemap, and static/dynamic social images implemented and merged.
- **Additional delivered scope:** uploads, metadata prefill, README import, submission rate limiting, daily/manual GitHub refresh, 30-day star history, and file seeding.
- **R6 / R7:** ownership/maintainer editing and featured homepage sections remain unimplemented MVP+ work.

Next: finish public discovery and release acceptance before adding
ownership, bookmarks, or editorial sections.

## Repository conventions and validation

- Use one branch and one checklist per vertical slice, such as `feat/r5-resubmit`.
- Define oRPC contracts before handlers. API authorization is independent from route guards.
- Public list/detail/search/category counts and future sitemap queries select `published` on the server.
- Follow the root README's disposable-schema wrapper for database-dependent checks. It migrates a temporary schema in `altstack_development` without resetting application data in `public`.

```sh
vp install
vp check
vp run --filter @altstack/db test:scoped -- vp test run
vp run --filter @altstack/db test:scoped -- vp run -r test
vp run -r build
```

The root `ready` script combines check, recursive tests, and builds; run it through
`test:scoped` for acceptance. The existing `test:categories-http` script uses
`test:isolated`, which resets development application data; provide a safe scoped
replacement before routine release use.

### Reconciliation evidence — 2026-10-13

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
- `removed` is a supported hidden status. `admin.project.remove` physically deletes the project and cascades repository/category/history rows; its audit remains with the project FK set to null. Deletion is not a retained terminal submission record.
- Original submitters can correct only their rejected intake through `submission.getById` / `submission.resubmit` and a private Edit & Resubmit modal. Name/repository/website changes retain ID, slug, provenance, enrichment and media; state returns to draft and current feedback clears transactionally. Repeating create still returns `409` for existing repositories, including rejected ones.
- Private procedures require a session; admin project/category/upload procedures also require role `admin`.
- Intake accepts any authenticated session. GitHub OAuth is the primary sign-in UI, but enabled email/password accounts are not checked for a linked GitHub account. Resolve the launch policy explicitly.

### Publish, audit, search, and GitHub

- Publish requires name, slug, canonical repository, tagline, description, logo, and **1–3 leaf categories**. Drafts can be incomplete.
- Intake suffixes colliding slugs numerically. Admin create/edit returns `409` for slug/repository conflicts or a concurrent edit.
- Audit covers create, update, remove, submit, and status change. Admin update writes `project_updated` plus `project_status_changed` when status or reason changes, transactionally. The original exactly-one-event moderation design is superseded.
- Rejection requires a trimmed, nonblank reason of at most 1000 characters in API and UI. Both admin create and the final merged PATCH state are checked before GitHub/media work. A PATCH may retain a valid stored reason but cannot clear it while remaining rejected. Legacy rejected records remain readable; restoring them clears the current note while audit history retains prior feedback.
- Homepage validates `q`, `category`, `sort`, and `page`; only these values are loader dependencies. Filter changes preserve other filters and reset pagination.
- Search uses PostgreSQL generated `tsvector` + GIN. Category filtering includes descendants; direct assignments use leaves in a maximum three-level hierarchy.
- Canonical URLs and GitHub-resolved identity constraints protect duplicates. A service token validates public data, not maintainer ownership.
- Public statistics read DB snapshots. Refresh stores stars/forks, last commit, repository creation, latest release, and fetch timestamps. History uses actual observations, not reconstructed data or a trending score.

---

## R0 — Catalogue data

**Outcome:** enough accurate content to make browsing useful.

- [x] Project/repository/category/path/assignment/audit schemas, migrations, and canonical uniqueness.
- [x] CSV/JSON importer with dry-run, validation, transactional writes, idempotent skipping, and optional GitHub statistics/README fetch.
- [x] Parser, importer, CLI, migration, and concurrency tests.
- [ ] Import/review at least **20 real published projects** with correct copy, logo, links, and leaf categories.
- [ ] Verify target migrations and repeat the curated import without duplicates or changes to existing records.
- [ ] Verify real metadata/media. Committed `data/projects.*` files are draft templates with example URLs, not verified launch content.

Evidence: [file-seeding guide](file-seeding.md), `packages/db/src/seed-file-*.ts`,
and `packages/db/tests/seed-file-*.test.ts`. The demo seed has been removed.

## R1 — Browse

**Outcome:** visitors discover published projects without signing in.

- [x] `project.list` / `project.getBySlug`, pagination, published-only visibility, and generic not-found behavior.
- [x] Homepage grid and `/$slug` detail with identity, links, Markdown, categories, optional screenshot, and GitHub statistics.
- [x] Empty states, safe optional website handling, and API/UI visibility/statistics coverage.
- [ ] Complete staging browse/detail/mobile smoke with real content and storage.

Evidence: `packages/api/src/routers/project.ts`, `apps/web/src/routes/_app/`,
`packages/api/tests/submission-review.test.ts`, and web GitHub statistics tests.

## R2 — Find and taxonomy

**Outcome:** visitors narrow the catalogue and share the exact result.

- [x] Full-text search; newest, oldest, name, most-stars, and most-forks sorts.
- [x] Debounced search, filters, validated URL state, empty/reset/pagination states.
- [x] Hierarchy/subtree filtering, published-only counts, `/categories` and nested category pages, breadcrumbs, canonical metadata, and historical-path redirects.
- [x] Admin category CRUD at `/admin/categories` with depth/cycle/leaf/path integrity.
- [x] API/model/route/form/catalogue UI tests; category HTTP acceptance script exists.
- [ ] Verify shared URL, reload, back/forward, redirects, and combined filters in staging.
- [ ] Record EXPLAIN/index evidence on a representative dataset; a declared index alone does not prove performance.

Evidence: project/category/admin-category routers, web category features/tests,
and [admin category API notes](category-admin-api.md).

## R3 — Sign in

**Outcome:** developers establish sessions for private submission workflows.

- [x] Better Auth GitHub OAuth configuration, sign-in/out, session-aware navigation.
- [x] Private layout and submit guards, sanitized local return URL, independent API checks, private `/submission`, and role-specific navigation.
- [ ] Verify real GitHub login, refresh, logout, expired session, and return URL in staging.
- [ ] Enforce GitHub-linked-only intake, or explicitly approve intake from any authenticated account; current API implements the latter behavior.
- [ ] Document/verify OAuth callback and initial admin provisioning.

Evidence: `packages/auth/src/server/config.ts`, API procedures, auth/main routes,
and `apps/web/src/utils/return-to.ts`.

## R4 — Submit intake

**Outcome:** signed-in users suggest repositories without publishing them.

- [x] Name + repository + optional HTTP(S) website; canonicalization, public GitHub verification, alias/duplicate checks, slug suffixes, atomic draft/metadata/audit creation.
- [x] Protected `/submit`, confirmation, searchable/paginated private `/submission`.
- [x] Shared create/resubmit Upstash quota: five validated attempts per ten minutes/account; race-safe ten-open-draft cap.
- [x] Typed `429` data and RPC/REST headers; editable form/countdown, no automatic retry, Redis failure stops creation.
- [x] Tests for authorization, identity/races/capacity, rollback, visibility, quota, and cooldown.
- [ ] Verify real Redis behavior with dedicated development/staging credentials; Upstash integration is opt-in.

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

**Merged-revision verification gate:** record the tested merged commit and actual
results for `vp check`, the disposable-schema root test suite, and
`vp run -r build` before release. Implementation-branch runs do not establish
verification of the merged revision.

**Separate R5b release gates:** real OAuth/Upstash and keyboard/mobile staging
smoke, reject → correct → resubmit → re-review, and matching deployment remain
unverified. Automated implementation completion does not close these gates.

## Delivered scope beyond the initial plan

- [x] **Admin media:** logo/screenshot upload, crop, temporary-to-final promotion, replacement, and cleanup through S3-compatible storage.
- [x] **Metadata prefill:** preview/apply GitHub description and website without automatically saving.
- [x] **README import:** pinned sanitized Markdown, BlockNote preview, explicit replace/append, stale-request protection, Save-only persistence. See [README import](github-readme-import.md).
- [x] **Statistics refresh:** shared admin POST and daily sequential CLI, batch lock, best-effort enrichment, rate-limit stop, identity/concurrency protection.
- [x] **Star history:** additive migration, daily WIB observations, honest cold-start/gap/staleness states, detail chart/comparison, repository-ID continuity, and 90-date retention. This supersedes the earlier graphs/30-day-growth exclusion; trending rankings remain deferred.
- [x] **CSV/JSON seeding:** replaces demo seed; categories/projects/relationships, optional GitHub enrichment, dry-run, repeat imports.
- [x] **Project activity:** public `/activity` displays recent commits from the AltStack repository.
- [ ] Apply metadata/history migrations, deploy matching revisions, inspect first refresh/history point, and verify daily **02:00 Asia/Jakarta** schedule. See [rollout guide](github-statistics-refresh.md).

These implementations do not prove production service/schedule configuration.

## Next public-release slices

Recommended remaining order: **L2 → launch acceptance**. R5a/R5b and L1 are
implemented and merged; their open acceptance gates still apply before release.

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
- [x] Safe truthful JSON-LD and readable project Markdown in SSR while preserving the BlockNote viewer.
- [x] Verify real SSR HTTP metadata, missing/nonpublic detail, canonical redirects, image updates/unpublish, offline resource packaging and cold Node/Nitro runtime.

Implementation/regeneration, indexing/cache policy, actual verification and
remaining release checks: [L1 notes](seo-og.md). Images are generated locally
with a pinned Node-compatible `@vercel/og`; no hosted image service is required.

### L2 — Finish public UI affordances

- [ ] Remove or clearly disable Verify/Bookmark/Report/Embed and the account menu's Bookmarks action until implemented; remove the unsupported verification/ranking promise.
- [x] AltStack branding, icons and manifest copy replace starter identity.
- [ ] Replace generic screenshot placeholders with honest empty states.
- [ ] Verify keyboard/mobile navigation, loading/error/not-found states, images, and external links.

**Done when:** every enabled action works and public copy matches the product.

### Launch acceptance and operations

- [ ] Finish L2, pass L1 release-domain/social-crawler and R5a/R5b staging acceptance, and resolve the intake-account policy.
- [ ] Verify at least 20 accurate published listings and real media/links.
- [ ] Pass format/lint/typecheck, root/workspace tests, and builds on the release revision; explicitly record skipped integrations.
- [ ] Staging smoke: browse → search/shared URL → categories → GitHub sign in → submit → enrich/publish → public detail; reject → private feedback → correct/resubmit → re-review.
- [ ] Verify direct API `401`/`403`, hidden draft/rejected/removed detail, quotas/capacity, and expired sessions.
- [ ] Document OAuth callback/admin bootstrap/CORS/runtime secrets/S3 public URL and lifecycle/Redis without exposing secret values.
- [ ] Apply migrations, confirm matching Docker tags and rollback/forward-fix procedure, verify backup/restore readiness.
- [ ] Inspect statistics CLI, first history point, daily schedule, and failure logs. A full 30-day history is not a launch blocker; observations start after rollout.

Keep operator items open until execution evidence exists.

## R6 — Own and edit (MVP+)

Start after launch when maintainers request control.

- [ ] Nullable `ownerId` / `claimedAt`, separate from submission provenance.
- [ ] One claim policy verified with user-specific GitHub credentials, never service-token permissions.
- [ ] Claim and owner/admin update procedures/UI for copy, links, media, content, categories.
- [ ] Owner/non-owner/admin, unlinked account, verification failure, concurrent claim tests.

**Done when:** verified owners maintain listings; direct unauthorized mutations fail.

## R7 — Curate (MVP+)

Start after launch when catalogue size/feedback justifies editorial sections.

- [ ] `featured` plus admin-only feature/unfeature.
- [ ] Most Starred, Recently Added, Editor's Picks with published-only data and matching search links.
- [ ] Empty-state/visibility coverage; trending and score/personalized feeds stay separate.

Existing most-stars/newest sorting is not implemented homepage sections.

## Later, only when justified

- Guest submission/abuse review when OAuth blocks legitimate submissions.
- Bookmarks/collections/compare when users return to save/evaluate tools.
- Report/correction workflow when catalogue errors create recurring support work.
- Notifications when review turnaround/status checking becomes a problem.
- Webhooks/trending when observed refresh/history data supports them.
- Meilisearch when measured PostgreSQL search quality/latency is insufficient.
- Galleries/video, scores, analytics, newsletter/RSS, profiles/reviews, SDKs, extensions after feedback.

## Release close-out template

- Shipped scope, commit, deployment version.
- Deferred work and skipped checks.
- Migration and rollback/forward-fix notes.
- Test commands/results and manual smoke evidence.
- Operator status, limitations, observed need for the next slice.
