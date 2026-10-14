---
title: AltStack Product Requirements
version: 2.1
status: Pre-launch — implementation reconciled
last_updated: 2026-10-14
---

# AltStack

## Product summary

AltStack is a curated directory for open-source software. It helps developers
answer: **“What open-source tool should I try for this job?”**

The first product is a small, trustworthy catalogue. [The roadmap](roadmap.md)
records implementation status, remaining slices, and release acceptance.
This PRD was reconciled against baseline commit `f876eb1`; implementation does
not imply production deployment.

## Problem and target users

Discovery is fragmented across GitHub, posts, launch sites, and old awesome lists.
Maintainers need a focused place to present their projects.

- **Explorer:** browses and narrows a set of open-source tools.
- **Maintainer/submitter:** suggests a repository and follows its review.
- **Admin:** reviews, enriches, and maintains accurate catalogue entries.

Launch has only `user` and `admin` database roles. Verified ownership is a later
capability, separate from submission provenance.

## Product principles

1. Finish one useful user journey at a time.
2. Reuse existing infrastructure; introduce dependencies for observed needs.
3. Use truthful labels: most-starred sorting and observed star changes do not constitute trending.
4. Enforce authorization in server/API procedures independently from UI guards.
5. Measure PostgreSQL search on representative data before adding another search service.
6. Distinguish implemented features, automated checks, and operator rollout.

## Launch definition

The first public launch is complete when visitors/users can:

1. Browse at least 20 accurate published projects and open working repository/website links.
2. Search, filter by category, sort, paginate, and share the result URL.
3. Open canonical public pages with correct titles and link-preview metadata.
4. Sign in with GitHub, suggest a repository, and privately track review status.
5. Have an admin enrich/publish or reject with actionable feedback.
6. Correct a rejected submission and return it to review without creating another listing.

The roadmap also requires staging smoke, production builds, migrations, runtime
configuration, and deployment acceptance. Claiming ownership, editing published
listings as a maintainer, featured sections, and bookmarks remain MVP+.

## Explicit non-goals for launch

- Collections, bookmarks, comparisons, reviews, ratings, follows, and profiles.
- Quality scores, hidden-gem/fast-growing rankings, personalized/trending feeds.
- Guest intake and anonymous-IP rate limiting.
- Queues/webhooks/workers beyond the existing daily GitHub statistics CLI.
- Rich media galleries/video, analytics dashboards, newsletters, extensions, SDKs.
- A separate moderator/curator role or multi-role moderation product.

Category management, S3-compatible logo/screenshot uploads, README import,
Upstash submission limiting, statistics refresh, and observed star history have
already been implemented beyond the initial lean scope. They are current
capabilities/dependencies, not deferred proposals.

## Release scope

- **R0 — Catalogue data:** migrations and repeatable CSV/JSON import; verify real launch content.
- **R1 — Browse:** published-only list/detail and public links.
- **R2 — Find:** PostgreSQL search, shared URL filters, hierarchical categories, and taxonomy management.
- **R3 — Sign in:** GitHub OAuth, private routes, session-aware navigation, API checks.
- **R4 — Submit intake:** minimal authenticated draft creation and private status tracking.
- **R5 — Moderate + enrich:** admin listing enrichment/review/history and required feedback; finish submitter resubmission.
- **L1/L2 — Public release completion:** catalogue SEO/link previews and honest UI affordances.
- **R6 — Own & edit:** verified ownership and maintainer editing after launch.
- **R7 — Curate:** featured flags and editorial homepage sections after launch.

See the roadmap for checked implementation items versus unverified acceptance.

## Functional requirements

### R0 — Catalogue data

- Import curated projects/categories from CSV or JSON without resetting application data.
- Validate publishable copy/media/category fields; use canonical repository uniqueness.
- Repeat imports skip existing records without overwriting user submissions.
- GitHub enrichment is opt-in; templates are examples, not verified repositories.
- Verify at least 20 accurate published listings before launch.

### R1 — Browse

- `project.list` and `project.getBySlug` return published projects only; missing/nonpublic detail returns generic `404`.
- REST read mappings currently use `QUERY /projects` and `QUERY /projects/{slug}`; the public web detail route is `/$slug`.
- Detail shows copy, repository/optional website, Markdown content, categories, optional screenshot, and stored GitHub statistics.
- Private submitter identity/rejection notes are excluded from public responses.

### R2 — Find and categories

- Text, one category subtree, sorting, and pagination work together.
- Sorts: newest, oldest, name, most-stars, most-forks.
- Homepage validates `q`, `category`, `sort`, `page`; changes preserve other filters and reset the page.
- PostgreSQL full-text search indexes name/tagline/description.
- Category hierarchy has at most three levels; published projects need 1–3 direct leaf assignments.
- Public category pages have canonical paths, historical redirects, published-only counts, and basic metadata.
- Admins manage taxonomy with server-side hierarchy/path/assignment integrity.

### R3 — Sign in

- GitHub OAuth is the required product sign-in path.
- Private pages use UX guards; private/admin API procedures enforce session/role independently.
- Return URLs must be sanitized local paths.
- **Open launch decision:** current intake accepts any authenticated session, including enabled email/password accounts. Enforce a linked GitHub account if retaining GitHub-only intake, or explicitly approve the broader policy.
- Real OAuth login/logout/expiry and admin provisioning require staging verification.

### R4 — Submit intake

- Collect name, public GitHub repository URL, and optional HTTP(S) website.
- Verify public repository existence/identity and canonicalize aliases; duplicates return `409`.
- Atomically create one `draft` project with submitter ID, basic repository metadata, and submission audit. It remains private; the UI calls it Awaiting review.
- Assign a slug, suffixing collisions numerically.
- Limit validated create attempts to five per ten minutes/account via Upstash, and open drafts to ten/account.
- Do not create partial records after GitHub, Redis, or transaction failure.
- Private submission tracking exposes only the current user's records and feedback.

### R5 — Moderate + enrich

- Admins list/filter review candidates and create/edit projects at `/projects`.
- Publish requires complete name/slug/repository/tagline/description/logo and 1–3 existing leaf categories.
- Verify fresh basic GitHub data before publication/repository changes; update the existing record transactionally with categories and audit.
- Current UI supports save draft, publish, reject, restore, unpublish, and delete.
- Audit records update/status changes; review history is paginated. One mutation can legitimately write both update and status-change events.
- Rejection requires actionable nonblank feedback after trimming, with a 1000-character maximum, in admin create/update APIs and the review UI. Updates may retain a valid existing reason; legacy rejected records remain readable and restorable. Inline validation blocks empty Reject without preventing switching to draft/restore, and audit history retains feedback.
- **Required before launch, not implemented:** original submitters can edit only rejected intake name/repository/website and atomically return it to `draft`, clearing current reason and preserving history.
- Resubmission must enforce owner/status/conflict/concurrency checks, quotas/capacity, and private visibility. It does not confer ownership or permission to edit published content.

### Delivered enrichment and infrastructure

- Admin logo/screenshot uploads use S3-compatible storage and temporary-to-final promotion.
- GitHub description/website prefill and pinned sanitized README import preview changes locally; Save persists them.
- Manual/admin and daily CLI refresh update repository statistics/metadata; public pages read DB snapshots.
- Public `/activity` displays recent AltStack repository commits.
- Star history records actual daily WIB observations, with cold-start/gap/staleness handling and 90-date retention. No synthetic 30-day backfill or trending ranking.
- Operator migration/backfill/schedule remains separate from implementation. See [statistics rollout](github-statistics-refresh.md) and [README import](github-readme-import.md).

### L1 / L2 — Public release completion

These are recommended pre-launch slices identified during reconciliation.

- Add AltStack defaults, per-project canonical/title/description, social-preview metadata, and published-only sitemap.
- Define indexing policy for private/auth/admin pages and verify server-rendered metadata.
- Remove or clearly disable unimplemented Verify/Bookmark/Report/Embed actions and unsupported ranking promises.
- Replace starter branding/placeholders and verify mobile, keyboard, empty/error/not-found states.

### R6 / R7 — MVP+

- Claim requires a documented policy verified through user-specific GitHub credentials.
- Keep `ownerId` / `claimedAt` separate from `submitterId`; neither is implemented yet.
- Verified owners can edit published copy/links/media/content/categories with server authorization.
- Featured flags/editorial sections remain future work; existing sort options do not count as shipped homepage sections.

## Project lifecycle

Current storage uses a single project record:

- `draft`: hidden, awaiting review or an incomplete admin draft.
- `published`: publicly visible, editable by admins.
- `rejected`: hidden; required feedback is visible to submitter/admin. Historical records may have no note; keeping them rejected through an update requires valid feedback.
- `removed`: supported hidden status.

Admins can restore rejected records or unpublish to draft. Submitter-driven
`rejected` → `draft` is planned, not currently available. All duplicate create
attempts still conflict, regardless of status.

Admin remove physically deletes the row and cascades related data. Its audit
survives with a nullable project reference. Do not assume deleted projects remain
available in submission tracking or that `removed` is terminal for admin updates.

## Data model boundaries

- `projects`: copy/media/links/status, nullable submitter FK and rejection reason, timestamps, generated search vector. No ownership fields yet.
- `github_repositories`: one per project, canonical owner/repo, GitHub repository ID, statistics/metadata/fetch timestamps.
- `github_star_history`: daily project/date observations.
- `categories`, `category_paths`, `project_categories`: taxonomy, historical path ownership, leaf assignments.
- `audit_log`: create/update/remove/submit/status events, actor, nullable project FK, reason/metadata/time.

There is no active separate submission table. Canonical repository URL is unique
on projects; repository metadata also has unique project and owner/repo identity.
Publication enriches the existing submitted project.

## Technology and operations

- React, TanStack Start/Router/Query, Tailwind, shared UI, BlockNote.
- oRPC contracts and Drizzle/PostgreSQL full-text search.
- Better Auth/GitHub OAuth; Upstash for submission quotas.
- S3-compatible storage for admin media; CSV/JSON import for initial content.
- Docker server/web images and operator-managed daily GitHub CLI schedule.
- Use disposable schemas for DB test runs; production rollout requires migration and runtime configuration evidence.

## Success signals and later backlog

After launch, measure accurate catalogue coverage, successful browse/search/detail
journeys, submission decisions within one business day, and authorization checks.

Prioritize ownership/editing, curation, bookmarks/collections/compare, corrections,
notifications, or guest intake from observed usage. Evaluate another search
service only after measuring PostgreSQL. Webhooks/trending, rich galleries/video,
scores, analytics, newsletter/RSS, profiles/reviews, SDKs, and extensions remain
later work.
