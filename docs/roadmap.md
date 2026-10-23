# AltStack Roadmap — Lean Releases

> Execution companion to [the PRD](prd.md). Reconciled on **2026-10-23** against
> `dev` commit **`4ce2d9c`**. Checked implementation items describe this checkout.
> Release contents, operator-reported rollout and recorded verification are
> tracked separately; unchecked operational items mean evidence is still missing.

Review-email implementation notes below apply to this feature worktree based on
`c3e0980` (including current auth fixes and Vite+ 1.4.0). They are not a new release
or production-rollout confirmation.

## Release baseline and evidence

- **v0.2.0** (`0c75022`): project mentions/hover previews, sharing, footer and media fixes, on top of the existing catalogue, submission, SEO and Embed capabilities.
- **v0.3.0** (`bb30efe`): includes Bookmarks (#105), report intake (#108), admin report inbox (#109), revised R7 Featured Projects (#110), and related UI fixes. The operator confirmed rollout on **2026-10-22** in the project conversation. Production was not independently inspected in this reconciliation.
- **After v0.3.0, merged into this baseline:** Docker development/test databases (#112, `6a1f465`), GitHub Topics tags (#113, `f023003`), GitHub + Resend Magic Link auth and rate-limit fixes (#115, `34d63a7`), and scoped-validation instructions (`4ce2d9c`). Their deployment is not established by the v0.3.0 rollout confirmation.

Feature documents retain their original branch test/QA results. Those historical
runs are not fresh checks of this baseline. The original reconciliation used
documentation checks only. Fresh, targeted checks for the later review-email
implementation are recorded under R5c; production acceptance remains separate.

## Operating rules

1. Deliver vertical slices: schema/migration → API contract and authorization → UI → focused tests → deployable demo.
2. Target one focused outcome in 1–3 solo development days; split larger work before coding.
3. Reuse infrastructure unless an observed need justifies another dependency.
4. Keep migrations forward-only and additive.
5. Record implementation, tests, and operator rollout separately. Merged code is not deployment evidence.

## Current delivery status

- **R0 — Catalogue data:** schema and CSV/JSON importer implemented; real launch content needs verification.
- **R1 — Browse:** public list/detail implemented.
- **R2 — Find:** full-text search, filters, sorting, pagination, public category pages/admin taxonomy, and GitHub Topics tags with public/admin pages implemented. Tags are merged after v0.3.0.
- **R3 — Sign in:** GitHub OAuth + Resend Magic Link, server-disabled password auth, shared dialog/route, session-aware navigation, route guards and API authorization implemented. Magic Link is merged after v0.3.0; live delivery and production cookie checks remain open.
- **R4 — Submit intake:** authenticated minimal intake and private tracking implemented with `projects.status = 'draft'`.
- **R5 — Moderate + enrich:** admin review, publish validation, required rejection feedback, history, enrichment, and original-submitter resubmission implemented.
- **R5c — Review emails:** Published/Rejected decision outbox, bounded Resend retry and shared React Email templates implemented in this worktree; migration, scheduler and live inbox acceptance pending.
- **L1 — SEO and link previews:** route metadata, structured data, indexing, sitemap, and static/dynamic social images implemented and merged.
- **L2 — Public UI:** branding, honest media/copy, accessible navigation, loading/recovery and link cleanup implemented. Embed, Bookmark and Report are now functional; only Verify remains deferred.
- **Project Embed:** public URL-controlled dialog and SVG badges implemented, including the designer-provided artwork; included in the released baseline, with domain/CDN acceptance evidence still separate.
- **Public content/media polish:** SSR Markdown/GFM, Shiki code blocks, project mentions/hover previews, cached-image decoding and stored-public-content preparation implemented and included in released code.
- **Private Bookmarks:** merged and included in v0.3.0 for all authenticated accounts, with published-only private storage and a three-column workspace table; see [rollout and validation](bookmarks.md).
- **Report intake and admin inbox:** merged and included in v0.3.0; guest/session-aware private intake and admin-only Open → Resolved/Dismissed moderation. See [reports](project-reports.md).
- **R7 — Featured Projects:** revised detail-page curation implemented and included in v0.3.0; homepage remains the Latest catalogue.
- **Development/test infrastructure:** separate local Docker PostgreSQL 18 databases, disposable test schemas, browser/HTTP acceptance tools and scoped validation policy implemented.
- **Additional delivered scope:** uploads, metadata prefill, README import, submission rate limiting, daily/manual GitHub refresh, 30-day star history, and file seeding.
- **R6:** repository ownership/maintainer editing remains unimplemented; login and submission provenance confer no ownership.

Next product work: R6 ownership/maintainer editing, selected from user needs.
Review notifications are implemented in this worktree. Track migration/configuration
and live acceptance separately from those feature decisions. Homepage editorial
sections, collections and comparisons remain deferred.

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
- [x] GitHub Topics sync, `/tags` directory, `/tags/$slug` published catalogue, detail tag links and `/admin/tags` curation. See [tags](tags.md); merged after v0.3.0.
- [x] API/model/route/form/catalogue UI tests; category HTTP acceptance script exists.
- [ ] Verify shared URL, reload, back/forward, redirects, and combined filters in staging.
- [ ] Record EXPLAIN/index evidence on a representative dataset; a declared index alone does not prove performance.

Evidence: project/category/admin-category routers, web category features/tests,
and [admin category API notes](category-admin-api.md).

## R3 — Sign in

**Outcome:** developers establish sessions for private submission workflows.

- [x] Better Auth GitHub OAuth + Resend Magic Link, server password rejection, shared auth dialog/route, sign-in/out and session-aware navigation.
- [x] Hashed ten-minute single-use links, React Email delivery, persistent PostgreSQL IP/recipient quotas and safe callbacks. Better Auth/Drizzle adapter are aligned at 1.7.12 with row-lock contention regression coverage; see [auth](auth.md).
- [x] Private layout and submit guards, sanitized local return URL, independent API checks, private `/submission`, and role-specific navigation.
- [ ] Verify real GitHub login, refresh, logout, expired session, and return URL in staging.
- [x] Support intake for GitHub and verified email Magic Link users under the authorized auth policy; ownership/claims remain deferred.
- [ ] Verify live Resend delivery with a verified sender and production cookie flow in staging; see [auth rollout](auth.md).
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

**Verification record:** the branch results above are historical evidence, not
verification of `4ce2d9c`. Record affected-feature checks and justified integration
checks against the actual release revision under the current testing policy.
Real OAuth/Upstash and reject → correct → resubmit → re-review staging evidence
remain unrecorded here. The v0.3.0 rollout confirmation establishes operator-reported
deployment, not the outcome of each smoke check.

### R5c — Submission decision email

- [x] Notify the stored original submitter on actual Published/Rejected transitions; skip records without a recipient, unchanged saves and feedback-only edits.
- [x] Commit an outbox row with its status audit UUID; no mail before commit, rollback/stale-write protection, separate identities for resubmission/re-review.
- [x] Reuse Resend and existing private `/submission` → sign-in → Edit & Resubmit. Public links use `/$slug`; feedback remains private, escaped text.
- [x] Consolidate all React Email components in `packages/ui/src/emails` with shared brand layout/primitives and explicit exports. Preserve Magic Link HTML/text, ten-minute expiry and one-use copy.
- [x] Add the private scheduled server CLI, frozen payloads, concurrent-worker leases, eight-attempt/23-hour retry limits and synthetic HTML/text previews.
- [ ] Apply the additive outbox migration and runtime `EMAIL_APP_URL` configuration, deploy Web/API, and enable the every-minute container job.
- [ ] Record actual mail-client and live delivery/bounce acceptance with operator-owned test accounts.

Fresh local evidence on 2026-10-23: 146 scoped API review/resubmit/history/notification
tests, 44 auth, 23 web journey/sign-in, 8 shared email, 5 CLI and 1 additive migration
test passed. Scoped formatting/typed lint/typechecks, affected package builds and
web production build passed; T3 visual inspection covered desktop/360 px, long
feedback and hidden images. See [delivery/rollout limits](review-notifications.md)
and [rendered previews and exact verification scope](email-previews/README.md).
No real email, production migration, deployment or live scheduler was run.

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

## Delivered public-release slices

R5a/R5b, L1/L2, Embed, public content, Bookmarks, Reports and revised R7 are
implemented in released code. The dated verification below is retained as
history; it does not put v0.3.0 back into pre-launch status. Outstanding live
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

- [x] Original L2 scope retained disabled Verify/Bookmark/Report/Embed and account Bookmarks with accessible “Coming soon” labels. Subsequent slices enabled Embed, Bookmark and Report; only Verify is currently disabled.
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
decision to retain disabled controls. Verify remains a future workflow.
Bookmarks and the report inbox are separately implemented below after v0.2.0.
Release/staging acceptance remains a separate gate.

### Public project Embed — 2026-10-17

**Implemented and merged at `d49273a`.** Final artwork comes from
`apps/web/public/badge.svg`, bundled by the generator with dark/light variants
and proportional custom sizing.

- [x] Original Embed slice enabled Embed on desktop and More; subsequent slices also enabled Bookmark and Report, leaving Verify deferred.
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

- [x] Record operator-confirmed v0.3.0 rollout on 2026-10-22; its tag contains Bookmarks, Reports/inbox and revised R7. This does not certify every service check below.
- [x] Resolve intake policy: authenticated GitHub and verified email Magic Link sessions are supported in current code; password authentication is disabled. Magic Link is a post-v0.3.0 change.
- [ ] Record L1 release-domain/social-crawler and R5a/R5b live acceptance evidence.
- [ ] Verify at least 20 accurate published listings and real media/links.
- [ ] Attach revision-specific, affected-feature validation and justified integration/build evidence for the next release; explicitly record skipped integrations. Do not require a full suite for every task.
- [ ] Record staging smoke: browse → search/shared URL → categories/tags → GitHub or Magic Link sign in → submit → enrich/publish → public detail; reject → private feedback → correct/resubmit → re-review; bookmark → report → admin decision → Featured selection.
- [ ] Verify direct API `401`/`403`, hidden draft/rejected/removed detail, quotas/capacity, and expired sessions.
- [x] Document Docker dev/test separation and current auth/Resend/proxy/cookie configuration in the root README and [auth guide](auth.md).
- [ ] Verify real OAuth callback/admin bootstrap/CORS, storage public URL/lifecycle and Redis configuration without recording secret values.
- [ ] Record migration execution, matching API/web image tags, rollback/forward-fix procedure and backup/restore readiness for the deployment target.
- [ ] For post-v0.3.0 tags, apply `20261022111024_github-topic-tags` before API/web and run the existing GitHub refresh for topics backfill; confirm ongoing sync. See [tags](tags.md).
- [ ] For post-v0.3.0 auth, apply `20261022142815_organic_silver_samurai` (`rate_limit`) before API/web, configure server-only Resend sender/key and trusted proxy headers, and verify live delivery, one-use/expiry, GitHub and cross-subdomain session behavior. See [auth](auth.md).
- [ ] Inspect statistics CLI, first history point, daily schedule, and failure logs. A full 30-day history is not a launch blocker; observations start after rollout.

Keep evidence gaps open until execution is recorded. The earlier feature-branch
docs' statements that no deploy/merge occurred describe those test runs; the
release baseline above supersedes them for merge and operator rollout status.

## R6 — Own and edit (MVP+)

Start after launch when maintainers request control.

- [ ] Nullable `ownerId` / `claimedAt`, separate from submission provenance.
- [ ] One claim policy verified with user-specific GitHub credentials, never service-token permissions.
- [ ] Claim and owner/admin update procedures/UI for copy, links, media, content, categories.
- [ ] Owner/non-owner/admin, unlinked account, verification failure, concurrent claim tests.

**Done when:** verified owners maintain listings; direct unauthorized mutations fail.

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
Homepage editorial sections, trending, scores and personalized feeds remain deferred.

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

## GitHub Topics tags — merged after v0.3.0

Merged via #113 (`f023003`); implementation includes its review fixes.

- [x] `tags` / `project_tags`, immutable lowercase topic slugs, transactional sync during submission/resubmit/admin repository changes, manual/daily refresh and opt-in GitHub file import.
- [x] Admin `/admin/tags` create/search/edit/hide/unhide/delete; sync preserves display-name/description/hidden curation and deletion is restricted while any assignments remain.
- [x] Public `/tags` with search, alphabetical filtering, popular/name sorting and pagination; `/tags/$slug` published-project catalogue and project detail tag links.
- [x] Hidden/unknown/empty-public tags do not expose a public tag page; counts require published projects with repository rows. Topics are unrelated to GitHub release tags.
- [ ] Record target migration, initial topics backfill and production acceptance. The existing GitHub refresh job performs backfill; no new scheduler is required.

Evidence: [tags behavior/rollout](tags.md), `packages/db/src/tags.ts`,
`packages/api/src/routers/tag.ts`, `packages/api/tests/tags.test.ts` and web tag routes.

## Later, only when justified

- Guest project submission/abuse review when GitHub or email sign-in blocks legitimate intake. Anonymous report submission is already implemented.
- Collections/compare when users return to evaluate saved tools.
- Automatic corrections, report assignment/comments/email/reopen, and homepage editorial sections beyond the revised R7 scope.
- Webhooks/trending when observed refresh/history data supports them.
- Meilisearch when measured PostgreSQL search quality/latency is insufficient.
- Galleries/video, scores, analytics, newsletter/RSS, profiles/reviews, SDKs, extensions after feedback.

## Release close-out template

- Shipped scope, commit, deployment version.
- Deferred work and skipped checks.
- Migration and rollback/forward-fix notes.
- Test commands/results and manual smoke evidence.
- Operator status, limitations, observed need for the next slice.
