---
title: AltStack Product Requirements
version: 2.9
status: v0.4.0 rolled out — operational close-out first, R6 next
last_updated: 2026-10-24
---

# AltStack

## Product summary

AltStack is a curated directory for open-source software. It helps developers
answer: **“What open-source tool should I try for this job?”**

The product is a small, trustworthy catalogue. [The roadmap](roadmap.md) records
implementation status, ordered priorities and operational evidence. This PRD is
reconciled on **2026-10-24** against release tag **v0.4.0** (`b79593d`), whose
source tree matches this `dev` checkout at `08bb687`.

The operator confirmed **v0.4.0 production rollout** in the project conversation
on 2026-10-24. It includes the v0.3.0 Bookmarks, Reports/admin inbox and detail-page
Featured baseline, plus GitHub Topics tags, GitHub + Resend Magic Link and auth
fixes, review-decision emails, license discovery, archived metadata and ten
catalogue sorts including observed seven-day Trending. Docker dev/test isolation
and Vite+ 1.4.0 are also included in the release source.
Individual migration, scheduler, backfill and live-service checks still need
recorded evidence where absent. This reconciliation does not independently
inspect production or rerun historical feature tests.

## Problem and target users

Discovery is fragmented across GitHub, posts, launch sites, and old awesome lists.
Maintainers need a focused place to present their projects.

- **Explorer:** browses and narrows a set of open-source tools.
- **Maintainer/submitter:** suggests a repository and follows its review.
- **Admin:** reviews, enriches, and maintains accurate catalogue entries.

The product has only `user` and `admin` database roles. Verified ownership is a later
capability, separate from submission provenance.

## Product principles

1. Finish one useful user journey at a time.
2. Reuse existing infrastructure; introduce dependencies for observed needs.
3. Use truthful labels: Most popular explicitly means total stars; Trending means observed seven-day star growth, with insufficient observations ranked last. Neither implies a broader popularity signal.
4. Enforce authorization in server/API procedures independently from UI guards.
5. Measure PostgreSQL search on representative data before adding another search service.
6. Distinguish implemented features, automated checks, and operator rollout.

## Core catalogue journey

The original launch journey remains the core acceptance baseline:

1. Browse at least 20 accurate published projects and open working repository/website links.
2. Search, filter by category, sort, paginate, and share the result URL.
3. Open canonical public pages with correct titles and link-preview metadata.
4. Sign in with GitHub or a verified email Magic Link, suggest a repository, and privately track review status.
5. Have an admin enrich/publish or reject with actionable feedback.
6. Correct a rejected submission and return it to review without creating another listing.

The supporting workflows are implemented; the count and accuracy of real
published listings still need recorded evidence. The roadmap keeps content/service
smoke, migration/configuration and backup/restore checks separate from the
operator-confirmed rollout. Repository ownership and maintainer editing remain
future work. Bookmarks, guest/session-aware Reports, the admin report inbox and
detail-page Featured Projects are current capabilities, not launch blockers or
feature-branch proposals.

## Ordered priorities after v0.4.0

This is the execution order, shared with the [roadmap](roadmap.md#ordered-priorities-after-v040).
P0 is immediate release follow-through, not evidence of an active incident.
Missing acceptance records do not mean deployed features are unimplemented.

1. **P0 — Close out v0.4.0 operations and catalogue quality.** Record or verify the release's migrations/configuration, every-minute review-email job and live decision mail, daily GitHub refresh/topics/license backfill and Trending observations, auth/submission/review smoke, and at least 20 accurate published listings. Reuse existing evidence; fix confirmed user-facing failures before new features. Done when the focused checks and any failures have recorded outcomes/owners; historical unchecked items alone do not block R6.
2. **P1 — R6 ownership, then maintainer editing.** The next feature candidate for v0.5.0: R6a establishes a documented GitHub claim policy and Verify flow; R6b depends on it and enables authorized edits of published listings. Done when verified owners can maintain their listing, unauthorized updates fail and admin moderation remains intact. R6 is still unimplemented; v0.5.0 is a candidate, not a release commitment.
3. **P2 — Collections, then comparison.** Build on private Bookmarks when returning users need organized shortlists. Start with private named collections; define comparison fields and build comparison only after evaluation needs are confirmed. Public sharing and social features are separate decisions. Neither slice is implemented or assigned a release.
4. **P3 — Report workflow improvements.** Address observed admin bottlenecks with the smallest needed slice, such as reopen or follow-up, before assignment/comments/email or automated corrections. Existing intake and Open → Resolved/Dismissed decisions already work. No expansion is scheduled without report-volume or operator evidence.
5. **P4 — Homepage editorial discovery.** Consider curated homepage sections after catalogue coverage and browse feedback justify them. Existing detail Featured and Trending sort are delivered; a dedicated Trending/personalized feed is separate deferred scope. The current homepage stays unchanged until that scope is selected.
6. **P5 — Demand-driven backlog.** Guest submission, profiles/follows/reviews/ratings, galleries/video, newsletter/RSS, analytics dashboards, scores, SDKs and extensions stay deferred. Add Meilisearch only for measured PostgreSQL search limitations. Choose each slice from an observed problem rather than a target release number.

Email delivery/bounce webhooks and automatic outbox retention are unimplemented
reliability follow-ups, not prerequisites for the existing mail feature. Promote
a focused fix if delivery failures or retention requirements establish a need;
do not expand P0 into a new worker/webhook platform.

## Deferred product scope

- Collections, comparisons, reviews, ratings, follows, and profiles.
- Quality scores, hidden-gem/fast-growing rankings, personalized/trending feeds.
- Guest project submission. Anonymous reports already work; Magic Link auth already uses persistent IP and recipient limits.
- Queues/webhooks/workers beyond the daily GitHub CLI and focused review-email outbox CLI.
- Rich media galleries/video, analytics dashboards, newsletters, extensions, SDKs.
- A separate moderator/curator role or multi-role moderation product.

Current capabilities also include category/tag management, S3-compatible media,
README import, Upstash submission/report limits, GitHub refresh, observed star
history, transactional Magic Link email and review-decision email. These
supersede initial lean-scope exclusions. Review email migration/configuration,
scheduler and live inbox evidence belong to P0 close-out of the confirmed v0.4.0
rollout; missing records do not establish missing configuration.

## Release scope

- **R0 — Catalogue data:** migrations and repeatable CSV/JSON import; verify real launch content.
- **R1 — Browse:** published-only list/detail and public links.
- **R2 — Find:** PostgreSQL search, shared URL filters, hierarchical categories, GitHub Topics tags, license browsing, archived metadata, ten catalogue sorts and admin taxonomy/tag management.
- **R3 — Sign in:** GitHub OAuth + email Magic Link through Resend, private routes, session-aware navigation, API checks.
- **R4 — Submit intake:** minimal authenticated draft creation and private status tracking.
- **R5 — Moderate + enrich:** admin listing enrichment/review/history, required feedback, original-submitter rejected-intake resubmission and R5c decision emails.
- **L1/L2 — Public release completion:** catalogue SEO/link previews and honest UI affordances.
- **R6 — Own & edit:** unimplemented P1; R6a claim/Verify → R6b maintainer editing, next feature candidate for v0.5.0 after P0 follow-through.
- **R7 — Curate:** admin-managed Featured Projects on public detail pages; homepage unchanged under the revised 2026-10-22 scope. See [feature behavior and rollout](featured-projects.md).
- **Private Bookmarks:** per-account saved published projects and protected three-column table; included in v0.3.0.
- **Reports:** guest/session-aware private intake and admin-only inbox/moderation; included in v0.3.0.

See the roadmap for checked implementation items versus unverified acceptance.

## Functional requirements

### R0 — Catalogue data

- Import curated projects/categories from CSV or JSON without resetting application data.
- Validate publishable copy/media/category fields; use canonical repository uniqueness.
- Repeat imports skip existing records without overwriting user submissions.
- GitHub enrichment is opt-in; templates are examples, not verified repositories.
- Verify and record at least 20 accurate published listings in P0 post-rollout acceptance.

### R1 — Browse

- `project.list` and `project.getBySlug` return published projects only; missing/nonpublic detail returns generic `404`.
- REST read mappings currently use `QUERY /projects` and `QUERY /projects/{slug}`; the public web detail route is `/$slug`.
- Detail shows copy, repository/optional website, Markdown content, categories, optional screenshot, and stored GitHub statistics.
- Public documentation uses SSR `react-markdown`/GFM with raw HTML omitted, server-prepared Shiki light/dark code blocks, Copy feedback and published-project link mentions. Admin editing/import preview retains BlockNote.
- Content preparation accepts only a validated slug and loads stored published content with the same required repository row as public detail. Enhancement failure retains readable Markdown; missing/nonpublic content supplies no prepared data.
- Cached logo/screenshot completion uses image decoding results, with honest local missing/failure states and reset on source changes.
- Private submitter identity/rejection notes are excluded from public responses.

### R2 — Find and categories

- Text, one category subtree, sorting, and pagination work together.
- Sorts in display order: Oldest, Latest, Most popular, Name (A to Z), Name (Z to A), Most stars, Trending, Most forks, Last commit, Repository age. See [License browsing and archived repositories](#license-browsing-and-archived-repositories) for ranking definitions.
- Homepage validates `q`, `category`, `sort`, `page`; changes preserve other filters and reset the page.
- PostgreSQL full-text search indexes name/tagline/description.
- Category hierarchy has at most three levels; published projects need 1–3 direct leaf assignments.
- Public category pages have canonical paths, historical redirects, published-only counts, and basic metadata.
- Admins manage taxonomy with server-side hierarchy/path/assignment integrity.

### License browsing and archived repositories

- Included in the operator-confirmed v0.4.0 rollout. The [license guide](licenses.md) preserves feature-branch validation and deployment instructions; its historical pending-rollout statements are superseded by this release baseline.
- Persist GitHub license key/name/SPDX identity, canonical lowercase route slug, human document URL, and factual archived state. Full upstream SPDX identifier data avoids a small hardcoded license list; custom/nonstandard/undetected values display exactly `unknown` without an invented document link.
- Reuse existing GitHub initial/manual/daily/import pathways. Failed fetches preserve prior snapshots; successful snapshots can remove/change license and archival. Repository-ID replacements clear unrelated metadata/history; archived alone does not unpublish a project.
- `/licenses` and `/licenses/$slug` expose only published visible projects, scoped search/sort/pagination, stable URL history, accurate counts and category/tag-consistent SEO. The unknown bucket is discoverable but noindex; private-only/missing licenses return 404.
- Public catalogue cards show Stars → Last commit → License plus Archived where reported. Detail statistics place License immediately above Repository, retain Forks, and provide separate discovery/document links. Public navigation/footer expose Licenses.
- Ten catalogue sorts match the requested menu order. Existing query sort values remain compatible. The user selected Most popular = total stars and Trending = first-to-last observed star delta in the trailing seven-day WIB window, requiring two dates and placing missing observations last. Last commit uses newest first; Repository age uses oldest first; nulls last and project-ID ties are stable.
- P0 records target migration/matching API-web revisions, backfill and daily synchronization evidence. The feature requires no new admin CRUD or scheduler and includes no R6, collections or comparison scope.

### GitHub Topics tags

- Tags are repository `topics`, separate from release/version tags. `tags.slug` is the immutable lowercase identity; `project_tags` stores assignments.
- Sync topics transactionally during GitHub-backed submission/resubmission, admin create/publish/repository changes, manual/daily refresh and file import with `--github`. A failed fetch preserves stored tags; a successful empty topics snapshot removes assignments.
- `/tags` supports `q`, popular/name sorting, alphabetical/non-A–Z filtering and page-based directory browsing (60 per page). Popularity is published-project count, not stars.
- `/tags/$slug` uses existing project search/sort/pagination with a server-scoped tag filter. Hidden, unknown and zero-public-project tags return 404; the directory excludes them. Project detail shows visible tag links below categories. Homepage search values remain `q`, `category`, `sort`, `page`.
- `/admin/tags` permits create/edit/hide/unhide/delete with admin API checks. Display name/description/hidden curation survives sync; assigned tags cannot be deleted. Hidden tags are excluded from public displays and tag-filtered results. Deleting an unused tag does not prevent a future sync recreating it.
- Included in v0.4.0. Record migration, topic backfill and daily refresh evidence under P0; the existing GitHub job performs backfill. See [tags](tags.md).

### R3 — Sign in

- GitHub OAuth and email Magic Link through Resend are the two supported sign-in paths. Password authentication is disabled on the server. See [auth behavior and rollout](auth.md).
- Private pages use UX guards; private/admin API procedures enforce session/role independently.
- Return URLs must be sanitized local paths.
- Both auth dialog and `/auth/sign-in` reuse `SignInForm`: email request/check-inbox/resend/recovery plus GitHub. No Google or password sign-in is offered.
- Magic Link verification proves inbox ownership, signs in or creates a verified user, and preserves verified existing user identities, roles and GitHub associations. User-specific repository permissions are not inferred from email verification. Unverified legacy account cleanup follows Better Auth's documented protections; do not bulk-mark old accounts verified.
- Tokens are hashed, expire in ten minutes and are consumed once. PostgreSQL `rate_limit` persists five email requests per IP and five send attempts per normalized recipient across IPs per ten minutes, plus twenty verification requests per minute. The recipient key is HMAC-derived, and storage/delivery failures do not silently bypass quotas. The UI offers a sixty-second resend cooldown and honors server retry timing.
- Server-only Resend sender/key, React Email HTML/text, configured-origin callbacks, private/no-store auth responses and existing SSR cookie propagation are part of the implementation. Better Auth and its Drizzle adapter are aligned at 1.7.12 with PostgreSQL contention coverage.
- Intake accepts authenticated GitHub and verified email Magic Link users. A session does not prove GitHub repository ownership; R6 is planned as P1 and remains unimplemented.
- Included in v0.4.0. Live Resend delivery/verified sender, real GitHub OAuth, trusted proxy headers, cross-subdomain cookie flow and admin provisioning need target evidence under P0. Mock-mailbox HTTP evidence does not establish live delivery. See [auth rollout](auth.md).

### R4 — Submit intake

- Collect name, public GitHub repository URL, and optional HTTP(S) website.
- Verify public repository existence/identity and canonicalize aliases; duplicates return `409`.
- Atomically create one `draft` project with submitter ID, basic repository metadata, and submission audit. It remains private; the UI calls it Awaiting review.
- Assign a slug, suffixing collisions numerically.
- Limit validated create/resubmit attempts together to five per ten minutes/account via the existing Upstash counter, and open drafts to ten/account under a shared transaction lock. Invalid/unauthenticated inputs and private reads consume no quota; accepted attempts count even if later checks fail. Redis failure stops work; typed quota `429` data/headers drive an editable countdown with no automatic retry.
- Do not create partial records after GitHub, Redis, or transaction failure.
- Private submission tracking exposes only the current user's records and feedback.

### R5 — Moderate + enrich

- Admins list/filter review candidates and create/edit projects at `/projects`.
- Publish requires complete name/slug/repository/tagline/description/logo and 1–3 existing leaf categories.
- Verify fresh basic GitHub data before publication/repository changes; update the existing record transactionally with categories and audit.
- Current UI supports save draft, publish, reject, restore, unpublish, and delete.
- Audit records update/status changes; review history is paginated. One mutation can legitimately write both update and status-change events.
- Rejection requires actionable nonblank feedback after trimming, with a 1000-character maximum, in admin create/update APIs and the review UI. Updates may retain a valid existing reason; legacy rejected records remain readable and restorable. Inline validation blocks empty Reject without preventing switching to draft/restore, and audit history retains feedback.
- Original submitters can edit only rejected intake name/repository/website in a prefilled private Edit & Resubmit modal and atomically return it to `draft`, clearing the current reason. Preserve project ID, slug, submission provenance, enriched copy/media/categories and previous audit events; the submitter transition event records previous feedback and intake changes.
- Protected private read/resubmit procedures derive the submitter from the session, including for admins. Foreign/missing records return `404`, unauthenticated `401`, non-rejected or stale `409`. Recheck owner/status/client revision/capacity/conflicts transactionally after GitHub verification outside the transaction. Intake writes serialize by GitHub repository ID to protect rename races; canonical aliases and resolved identity cannot duplicate a listing.
- Preserve stored statistics/metadata/history across matching GitHub repository IDs; clear unrelated metadata/history for different or unknown prior identities and store fresh basic metadata. No synthetic star-history backfill. Failed validation/fetch/conflict/rate limit keeps corrections and feedback; success invalidates the private list/route and returns to Awaiting review in place. See [implementation policy](submission-resubmit.md).
- Resubmission confers no ownership or permission to edit published content. Live OAuth/Redis, reject → correct → re-review and target keyboard/mobile acceptance still need recorded evidence where absent; the overall v0.4.0 rollout has been operator-confirmed.
- Actual Published/Rejected transitions enqueue email for the stored original submitter in the review transaction, keyed by the audit UUID. Repeated saves/content/feedback edits and records without a recipient generate no mail; later resubmission/review can notify again.
- Published mail includes project name and public/private links. Rejected mail includes escaped actionable feedback and the existing private `/submission` → safe sign-in returnTo → Edit & Resubmit journey. It grants no ownership or public access to feedback.
- All React Email templates/layout/primitives live under `packages/ui/src/emails`, isolated from interactive UI exports; rendering/delivery/configuration stay server-side. Magic Link retains HTML/text and its original expiry/one-use lifecycle.
- A scheduled private CLI sends only committed outbox rows, freezes payloads, fences concurrent workers and retries with the same Resend key up to eight attempts within 23 hours. This is bounded provider deduplication, not exactly-once/inbox delivery. Missing configuration retains pending work; terminal/uncertain failures require operator reconciliation. See [rollout, scheduling, limits and fresh targeted verification](review-notifications.md).

Feature documents preserve historical verification. Record checks scoped to the
affected behavior and release revision under current AGENTS.md policy; do not
require a full suite for every change. Operator-confirmed rollout and individual
service acceptance results are separate evidence.

### Delivered enrichment and infrastructure

- Admin logo/screenshot uploads use S3-compatible storage and temporary-to-final promotion.
- GitHub description/website prefill and pinned sanitized README import preview changes locally; Save persists them.
- Manual/admin and daily CLI refresh update repository statistics/metadata; public pages read DB snapshots.
- Public `/activity` displays recent AltStack repository commits.
- Star history records actual daily WIB observations, with cold-start/gap/staleness handling and 90-date retention. No synthetic 30-day backfill. Trending uses these observations for an observed seven-day star delta.
- Operator migration/backfill/schedule remains separate from implementation. See [statistics rollout](github-statistics-refresh.md) and [README import](github-readme-import.md).

### L1 / L2 — Public release completion

L1 and L2 are implemented and included in the released baseline. Unrecorded
service checks remain in [operations evidence](roadmap.md#launch-acceptance-and-operations);
they do not change the v0.4.0 rollout status. See [historical L1 verification](seo-og.md).

- L1: AltStack defaults and distinct home/project/category metadata, committed static and dynamic 1200 × 630 social cards (project logo, stored GitHub stars/forks and snapshot date), published-only sitemap and robots discovery.
- L1: Explicit indexing/canonical/cache policy, safely escaped truthful JSON-LD, crawlable SSR project documentation, generic nonpublic/error responses and Node/Nitro runtime verification.
- L2 originally retained Verify/Bookmark/Report and account Bookmarks as disabled controls. The separately authorized [Private Bookmarks](bookmarks.md) implementation now enables Bookmark and the account menu across desktop/compact/mobile. The [Report / suggest correction](project-reports.md) intake now enables Report for guests, users and admins through `?dialog=report`; Verify retains its accessible “Coming soon” explanation.
- Replace generic screenshot placeholders with honest empty states and verify mobile, keyboard, empty/error/not-found states. AltStack branding, icons and manifest copy are implemented.
- Give hero controls real destinations or noninteractive semantics; remove unsupported compare/trending copy, recover from image failures, and complete accessible navigation and loader/error recovery. Ownership remains backlog; private report intake, its admin inbox and bookmarks are tracked separately.

### Private Bookmarks

Merged and included in v0.3.0. All authenticated accounts, including admins, can
save/remove a published project from desktop/compact/mobile detail actions and
open protected `/bookmarks` through account/sidebar navigation. Guests use the
existing sign-in handoff. The table contains only Name (logo/name link to the
public project), Description (tagline) and one Remove action, with pagination.

Session-derived account IDs, unique user/project pairs, private cache keys and
server authorization protect ownership. List/state/save require current public
visibility; unpublished projects disappear from lists without exposing their
data, and deletion cascades bookmarks. Removing a bookmark never deletes the
project. Pending/error/retry/empty-page behavior is implemented. See
[Bookmarks behavior and verification](bookmarks.md).

### Report / suggest correction

Merged and included in v0.3.0. `/<slug>?dialog=report` opens the accessible
public form, mutually exclusive with Embed and synchronized with direct links,
reload, history, closing and focus restoration without refetching project data.
Guests provide a valid email; sessions use server-derived user ID/email without
an email input. Type is required: Broken link, Wrong category, Outdated, Other.
The trimmed message is at most 2,000 characters and required only for Other.

Reports persist privately only for currently published targets. Missing/nonpublic
targets return the same 404 even for admins. Upstash allows five validated
attempts per ten minutes per account or normalized guest-email hash, with an
additional shared guest cap of fifty per ten minutes. Errors fail closed and
the form preserves input; no automatic retry or external email is sent. These
guest contact addresses are unverified. See [report intake](project-reports.md).

### Admin report inbox

Merged and included in v0.3.0. Admins use
`/admin/reports` to read private project reports (project/logo, contact email,
type, plain text message, date and status), defaulting to Open/newest first with
bounded cursor pages and status filters. Open reports may become Resolved or
Dismissed; concurrent decisions cannot overwrite each other. The existing
project editor performs corrections separately. Unpublished targets remain
editable, while deleted-project reports are retained without edit links.
Route and API guards require admin role, private responses use no-store, and
public data excludes all report details. Additive migration backfills Open and
retains report history through future project deletions. See
[report behavior, verification and rollout](project-reports.md).

### Public project Embed badges

Implemented and included in released code, including the designer-provided badge
artwork. Feature-local test results and target domain/CDN acceptance are separate.

- Desktop Embed and compact More → Embed open the accessible public dialog at
  `/<slug>?dialog=embed`, synchronized with direct links, reload and browser history.
- Default customization is dark, 200 × 50 regardless of the app theme. Live SVG
  preview and escaped, read-only HTML share strict dimension validation. Copy
  reports actual clipboard success or selects code for manual copying on failure.
- Public `/<slug>/badge.svg` accepts dark/light, width 160–1200 and height 40–400
  integer pixels. It uses the approved AltStack signature and truthful “Listed on”.
- Every request checks current published visibility; hidden/missing/deleted listings
  return generic 404, service failure 503. No-store responses prevent cached
  variants or conditional requests from bypassing publication checks.
- Snippets use the configured `VITE_APP_URL` origin, never request Host, with
  `altstack / badge / embed / project-<slug>` UTM attribution. Badge endpoints are
  noindex and excluded from sitemaps; dialog URLs retain clean detail metadata.
- Implementation/local verification and deployment are separate. See
  [Embed contract, cache and deployment notes](project-embed.md).

### R6 — Ownership and maintainer editing (unimplemented)

**P1, next feature candidate for v0.5.0.** Deliver R6a before R6b, using the
[roadmap's slice checklists](roadmap.md#r6--own-and-edit-mvp).

- **R6a — Claim / Verify:** define eligible personal/organization repository permissions, credential/linking requirements and revoked-access handling before implementation. Verify through user-specific GitHub credentials, never the shared service token, email verification or submitter identity. Keep nullable `ownerId` / `claimedAt` separate from `submitterId`; protect competing claims and provide actionable verification recovery.
- **R6b — Maintainer editing:** verified owners can edit published copy/links/media/content/categories with server authorization, existing content/category validation, stale-write protection and audit. Decide and document immediate publication versus admin review before implementing owner writes. Extend media authorization for owners without granting admin-wide upload access.
- Admin status changes, deletion, taxonomy/Featured/report management and repository ownership/identity changes remain governed by their explicit permissions. R6 does not implicitly grant these capabilities or introduce a new global account role.
- Acceptance covers owner/non-owner/admin, email-only/unlinked accounts, denied/revoked GitHub access, concurrent claims and edits, media access and direct API bypass attempts. Both slices remain unimplemented.

### R7 — Featured Projects (revised and delivered)

- Merged and included in v0.3.0. Admin `/admin/featured` selects/reorders/removes up to 21 projects, explicitly saves the global list and detects concurrent saves.
- Public detail uses published projects with repository rows and valid HTTP(S) websites, excludes the current project and exposes only preview fields. Logos open external websites; hover previews link back to public AltStack detail.
- Desktop/tablet places the panel below GitHub statistics; Featured sticks below the header while stats scroll away. Mobile puts the panel after Share buttons without sticky positioning. Empty selections hide the panel and preserve sticky statistics.
- Homepage remains the Latest catalogue ordered by project `createdAt`; R7 does not add homepage sections, a project `featured` boolean or trending rankings. Homepage editorial sections remain deferred. See [Featured Projects](featured-projects.md).

## Project lifecycle

Current storage uses a single project record:

- `draft`: hidden, awaiting review or an incomplete admin draft.
- `published`: publicly visible, editable by admins.
- `rejected`: hidden; required feedback is visible to submitter/admin. Historical records may have no note; keeping them rejected through an update requires valid feedback.
- `removed`: supported hidden status.

Admins can restore rejected records or unpublish to draft. Original submitters
can correct and resubmit their rejected record to `draft`. All duplicate create
attempts still conflict, regardless of status.

Admin remove physically deletes the row and cascades repository/category/history,
bookmark, Featured selection and tag-assignment rows. Audit and reports survive
with nullable project references; reports lose edit links. Do not assume deleted
projects remain available in submission tracking or that `removed` is terminal
for admin updates.

## Data model boundaries

- `projects`: copy/media/links/status, nullable submitter FK and rejection reason, timestamps, generated search vector. No ownership fields yet.
- `github_repositories`: one per project, canonical owner/repo, GitHub repository ID, statistics/metadata/fetch timestamps.
- `github_star_history`: daily project/date observations.
- `categories`, `category_paths`, `project_categories`: taxonomy, historical path ownership, leaf assignments.
- `tags`, `project_tags`: immutable GitHub topic identities, curated name/description/hidden state and project assignments.
- `bookmarks`: unique user/project pairs and saved timestamps; private per-account storage with cascading user/project deletion.
- `project_reports`: nullable project/user references, retained contact email/type/message/date and Open/Resolved/Dismissed status. No public read projection or separate moderation audit is implemented.
- `featured_projects`: global project/unique-position selection (0–20); no per-project featured boolean.
- Auth `user`, `session`, `account`, `verification` plus `rate_limit`: existing identities/roles, OAuth/session state, hashed Magic Link verification and persistent request/send quotas.
- `audit_log`: create/update/remove/submit/status events, actor, nullable project FK, reason/metadata/time.
- `submission_review_notifications`: private decision snapshot keyed by audit UUID; original recipient FK, frozen payload, attempt/lease/deadline/delivery state. Additive with no historical backfill; never exposed in public projections.

There is no active separate submission table. Canonical repository URL is unique
on projects; repository metadata also has unique project and owner/repo identity.
Publication enriches the existing submitted project.

## Technology and operations

- React, TanStack Start/Router/Query, Tailwind and shared UI; BlockNote for admin editing, react-markdown/GFM and server Shiki preparation for public documentation.
- oRPC contracts and Drizzle/PostgreSQL full-text search.
- Better Auth/GitHub OAuth + Resend/React Email Magic Link; PostgreSQL-persisted auth rate limits; Upstash for submission and report quotas.
- S3-compatible storage for admin media; CSV/JSON import for initial content.
- Docker server/web images and operator-managed daily GitHub CLI schedule.
- Local Docker PostgreSQL 18: development `altstack` on port 5432, separate tmpfs-backed `altstack_test` on port 5433, both loopback-only. Test target guards reject nonlocal/non-test databases and never fall back to the application URL.
- Use disposable schemas for DB tests, selected by affected feature/callers under [AGENTS.md testing scope](../AGENTS.md#testing-scope). Documentation-only changes need diff/link/format checks. Full-suite runs require an explicit request or concrete broad impact/baseline need, with the reason stated beforehand.
- Production rollout records migrations, runtime configuration and service acceptance separately from source/branch checks. Tags require GitHub refresh backfill; Magic Link requires the additive auth rate-limit table, server-only Resend sender/key and trusted reverse-proxy configuration. Docker dev/test changes do not replace production database configuration.

## Success signals and later backlog

After rollout, measure accurate catalogue coverage, successful browse/search/detail
journeys, submission decisions within one business day, and authorization checks.

Follow the [ordered priorities](#ordered-priorities-after-v040): P0 release
follow-through → P1 R6a claim/Verify → R6b maintainer editing → P2 collections
then comparison → P3 report improvements → P4 homepage editorial → P5 backlog.
P2–P5 remain conditional on observed needs, not committed releases. Existing
review emails, Featured, report intake/admin decisions, Magic Link and Trending
sort are delivered in the v0.4.0 baseline. Broader feeds, webhooks and social/media
work do not follow automatically from those features.
