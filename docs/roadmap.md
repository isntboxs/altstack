# AltStack Roadmap — Lean Releases

> This is the execution companion to `docs/prd.md`. It describes the smallest deployable slices, their boundaries, and their definition of done. Complete releases in order. Do not start a later release because it is technically convenient.

## Operating rules

1. A release is a vertical slice: schema/migration → API contract and authorization → UI → focused tests → deployable demo.
2. Target one focused outcome in 1–3 solo development days. If a release grows larger, split it before coding.
3. Do not add an infrastructure dependency merely to support a hypothetical future release.
4. Keep each migration forward-only and additive. Never make a schema field “temporary” if it represents a durable product concept.
5. Document real limitations after each release; update this roadmap rather than silently expanding scope.

## Delivery map

```text
R0 catalogue data
  └─ R1 browse
       ├─ R2 find
       └─ R3 sign in
            └─ R4 submit intake (minimal)
                 └─ R5 moderate + enrich ───► LAUNCH
                      ├─ R6 own & edit
                      └─ R7 curate
                           └─ later: automation and expansion
```

## Repository conventions

- Use one branch per release: `feat/rN-short-name`.
- Keep a single issue/checklist per release. Do not split database, API, and UI into separate release branches.
- Run `vp install` before beginning a new release, then run `vp check`, `vp run -r test`, and `vp run -r build` before merging.
- Existing worktree changes are not part of this roadmap unless explicitly included in the release issue.

## Shared implementation decisions

### API and authorization

- Define an oRPC contract before its router handler and test expected error codes.
- Public list/detail procedures always apply `status = 'published'` on the server; the UI never decides visibility.
- Protected procedures authenticate and authorize in the procedure/handler. `beforeLoad` is only the page-level UX guard.
- Use `400` for invalid input, `401` for no session, `403` for inadequate permission, `404` for unavailable public data, and `409` for a duplicate repository or conflicting state transition.

### Search state

- Home route owns validated `q`, `category`, `sort`, and `page` search params.
- Use a typed schema with defaults. If the project uses Zod v3 plus `zodValidator`, use `fallback()` from `@tanstack/zod-adapter`; Zod v4 can use `.catch()`.
- Search/sort/category changes preserve the other params and reset `page` to 1.
- `loaderDeps` contains only `q`, `category`, `sort`, and `page`; do not pass the entire search object.

### GitHub data

- Canonicalise an accepted URL to `https://github.com/<owner>/<repo>` before dedupe.
- Store only owner, repo, stars, forks, and `fetchedAt` through R5.
- A service token can fetch public metadata. It cannot verify that a user has permission to claim a repository.

### Lifecycle (R4 minimal intake + R5 enrich)

```text
submission: pending ──approve (admin enrich)──► project published
  │
  └─reject──► rejected ──valid resubmit──► pending

project: published ──remove──► removed (terminal)
```

`project.status = draft/rejected` is not used for user submissions in R4/R5; new projects are inserted as `published` on approval. All transitions are server-side checks. `removed` is terminal for users.

---

## R0 — Catalogue data

**Outcome:** there is enough clean content to make browsing and testing meaningful.

### Work

- [x] Add the smallest `project` schema required by R1: id, name, slug, tagline, short description, logo URL, repository URL, optional website URL, Markdown content, status, created/updated timestamps.
- [x] Add `github_repository` with a one-to-one project relation and only owner, repo, stars, forks, fetched timestamp.
- [x] Add unique constraints for project slug, canonical repository URL, project relation, and `(owner, repo)`.
- [x] Export schemas and relations from `packages/db/src/schemas.ts` and `packages/db/src/relations.ts`; register relations in `packages/db/src/index.ts`.
- [x] Add an idempotent seed path with 12–20 manually curated, `published` projects. Use deterministic identities so re-running does not create duplicates.
- [x] Generate and apply a migration; do not use schema push as the only proof of migration safety.

### Done when

- [x] A clean database migration plus seed can run twice without duplicate rows.
- [x] Each seed project has working GitHub data and a unique slug/repository URL.
- [x] No category, owner, audit, feature, guest-submission, or score fields have been added yet.

### Explicitly not in R0

API, routes, search, categories, authentication, GitHub requests, or admin tools.

---

## R1 — Browse

**Outcome:** a visitor can discover the catalogue without signing in.

### Work

- [x] Add `listProjects({ page, limit })` and `getProjectBySlug({ slug })` contracts and router procedures.
- [x] Public procedures filter `published` in the query itself. A non-public slug produces the same generic `404` as a missing slug.
- [x] Load stars/forks without N+1 queries.
- [x] Replace static homepage content with a paginated project grid and card.
- [x] Add `/$slug` with project identity, links, Markdown content, and repository stats.
- [x] Add API/route tests for public visibility, pagination, and missing/non-public detail.

### Done when

- [x] A visitor sees published projects only and can move between list and detail pages.
- [x] A direct detail request for `draft`, `rejected`, or `removed` does not disclose its existence.
- [x] Empty states and broken optional website URLs do not crash the page.

### Explicitly not in R1

Search, categories, sign-in, submit, moderation, home-feed sections.

---

## R2 — Find

**Outcome:** a visitor can narrow the catalogue and share the exact result.

### Work

- [x] Add `category` and `project_category` schemas, relations, migration, and idempotent seed assignments.
- [x] Add a PostgreSQL full-text-search migration/index for name, tagline, and short description.
- [x] Add `searchProjects` and `listCategories` contracts. `searchProjects` accepts optional query, one category slug, sort, page, and limit.
- [x] Enforce `published` in every public search query and whitelist sort mappings rather than accepting a column name from the client.
- [x] Add typed, validated URL state to the homepage. Search is debounced; category and sort preserve existing state and reset the page.
- [x] Add loading, empty, reset-filter, and pagination states.
- [x] Add query-builder tests, plus browser smoke coverage for back/forward and a shared URL.

### Done when

- [x] A URL such as `/?q=auth&category=backend&sort=most-stars&page=2` produces the equivalent result after reload, back/forward, and sharing.
- [x] Text, category, sort, and pagination work together.
- [x] Explain-plan checks show the intended index at a seed dataset large enough to be meaningful; do not impose a fixed latency target until a production-like data size exists.

### Explicitly not in R2

Tags/topics, maintainer/company search, Meilisearch, submit, and GitHub refresh.

---

## R3 — Sign in

**Outcome:** a developer can establish the GitHub identity needed for submissions.

### Work

- [x] Verify Better Auth GitHub OAuth configuration in development and production-like environments.
- [x] Add a sign-in affordance and session-aware header state.
- [x] Add an authenticated layout or per-route `beforeLoad` guard for future private pages, with a sanitized local return URL.
- [x] Keep server/API permission checks independent from route guards.
- [x] Add a protected “my submissions” shell route with an empty state; no ownership claim yet.
- [x] Test successful login, logout, expired session, direct protected API request, and open-redirect rejection.

### Done when

- [x] Sign in, refresh, and logout reliably change the visible session state.
- [x] Unauthenticated access to the private page redirects without revealing private loader data.
- [x] The matching private API procedure returns `401` even if someone bypasses the route UI.

### Explicitly not in R3

Email/password product work, roles beyond `user`/`admin`, claiming, editing, or GitHub repository permission checks.

---

## R4 — Submit intake (minimal)

**Outcome:** a signed-in developer can suggest a repository for review with minimal friction, without creating a public listing automatically.

### Work

- [x] Add `project_submission` table: id, `submitterId` (FK `user.id`), `projectName`, canonical `repositoryUrl` unique, optional `websiteUrl`, `status` (`pending`/`approved`/`rejected`), `submittedAt`, `moderatedAt`, `moderatedBy`, `rejectionReason`, timestamps. No tagline/description/logo/category columns here — enrichment is R5.
- [x] Add `submitSubmission` contract and a protected router handler.
- [x] Validate `projectName` (2–100 chars), canonicalise GitHub URLs to `https://github.com/<owner>/<repo>` (lowercased owner/repo, strip trailing slash/`.git`/extra path), and accept optional `websiteUrl` only as valid `http(s)` URL.
- [x] Check the canonical repository URL against **both** `project.repositoryUrl` and `project_submission.repositoryUrl`. Return `409` for an existing project or submission. Rely on the DB unique constraints for races.
- [x] Fetch public repository metadata once to validate existence and snapshot owner/repo/stars/forks. On not-found return a validation error; on GitHub availability/rate-limit failure return a retryable error and insert nothing. Do not hold a DB transaction open during the fetch.
- [x] Insert the submission row only. Do not create `project`, `github_repository`, or `project_category` rows yet. Slug, tagline, description, logo, content, and categories are deferred to admin enrich in R5.
- [x] Add a “submitted for review” confirmation and show the user’s own submissions with status in My Submissions (reads `project_submission`, not `project`).
- [x] Test input validation, canonicalisation variants, duplicate in each table, GitHub not found, fetch failure inserts nothing, and absence from public browse/search.

### Done when

- [x] A signed-in GitHub user submits name + repository URL (+ optional website) and receives a pending confirmation.
- [x] The submission is visible only to its submitter/admin and creates no public listing.
- [x] A duplicate canonical repository cannot be submitted by another user (`409`).

### Explicitly not in R4

Guest submission, anonymous-IP retention/rate limiting, tagline/description/logo/category input, slug editing, README import, topics, license, screenshots, or cron refresh.

---

## R5 — Moderate, enrich, and launch

**Outcome:** one admin can turn minimal submissions into complete published listings. This is the launch gate.

### Work

- [ ] Keep moderation fields on `project_submission` (`rejectionReason`, `moderatedAt`, `moderatedBy`); do not add them to `project` for launch.
- [ ] Add minimal `audit_log`: actor ID, action, target submission/project ID, optional metadata/reason, timestamp. It records moderation mutations only.
- [ ] Add protected admin contracts: list pending submissions, `approveSubmission`, `rejectSubmission`. Keep remove as an internal admin operation on `project` if needed before launch.
- [ ] `approveSubmission` input is the admin enrich step: tagline, short description, logo URL, optional website (prefilled from submission, editable), optional Markdown content, slug (prefilled from `projectName`, editable), and 1–3 existing category slugs.
- [ ] `approveSubmission` handler re-checks canonical duplicate, refetches fresh GitHub metadata, then in one transaction inserts the `published` project + repository metadata + category links, marks the submission `approved`, and writes exactly one audit event. Slug collision resolves with a numeric suffix or `409` if unresolvable; document the choice in the issue.
- [ ] Enforce admin authorization in each mutation. Ensure invalid state transitions return `409`.
- [ ] Build the smallest usable admin surface: a paginated pending-submissions list, approve form (enrich fields), and reject dialog requiring a reason. It lives in the protected `/dashboard` route inside the `web` app.
- [ ] Let the original submitter correct a rejected submission by editing only name/repository/website. Its narrow `resubmitSubmission` procedure atomically clears the rejection reason and sets status back to `pending`. General editing of published projects remains R6.
- [ ] Add moderation and audit tests. Run the complete smoke journey: seed → browse → search → sign in → submit (3 fields) → enrich/approve/reject → public/private assertions.
- [ ] Record deployment notes: required GitHub OAuth callback URL, admin bootstrap process, and known limitations.

### Done when

- [ ] An admin enriches + approves a submission and it immediately appears in browse/search as a complete listing.
- [ ] An admin rejects with a reason; the submitter sees it privately.
- [ ] A valid re-submission moves `rejected` back to `pending` for another review.
- [ ] Every moderation mutation creates exactly one audit event in the same transaction.
- [ ] `vp check`, `vp run -r test`, and `vp run -r build` pass on the release branch.

### Explicitly not in R5

Full dashboard CRUD, audit events for auth activity, featured projects, category management, analytics, queues, or scheduled sync.

---

## R6 — Own and edit (MVP+)

Start only when maintainers request control over their listings.

### Work

- [ ] Add nullable `ownerId` and `claimedAt` to keep submitter history separate from ownership.
- [ ] Define a single claim policy: repository owner, or owner plus verified admin collaborator. Record the policy in the API contract and UI copy.
- [ ] Verify against a user-specific GitHub credential; do not use the service token’s permissions as proof.
- [ ] Add claim and update procedures with owner/admin authorization checks.
- [ ] Let owners edit project copy, links, logo URL, Markdown content, and categories. Published edits remain published in this version.
- [ ] Test owner, non-owner, admin, unlinked GitHub account, failed permission check, and concurrent claim attempts.

### Done when

- [ ] Only a verified user or admin can change a listing.
- [ ] A non-owner direct mutation returns `403`; UI guards are not relied upon for security.

---

## R7 — Curate (MVP+)

Start only after moderation is stable and there is enough catalogue data to make sections useful.

### Work

- [ ] Add `featured` to published projects and an admin-only mutation to set it.
- [ ] Add homepage sections: Most Starred, Recently Added, and Editor’s Picks.
- [ ] Reuse the same public-project query policy; section data never exposes non-public projects.
- [ ] Add a link from each section to the corresponding search/sort URL.

### Done when

- [ ] Admins can feature/unfeature a published project.
- [ ] Sections display accurate names and source data; empty sections have a safe empty state.

### Explicitly not in R7

Trending, recently updated, fast-growing, score-based, or personalised feeds.

---

## Later, only when justified

| Need observed                                                 | Then add                                                 |
| ------------------------------------------------------------- | -------------------------------------------------------- |
| Legitimate maintainers cannot submit because they avoid OAuth | Guest submission, durable rate limiting, abuse workflow  |
| GitHub values become stale enough to mislead                  | Scheduled refresh/webhook plus history snapshots         |
| PostgreSQL search quality/latency fails on production data    | Meilisearch evaluation and migration plan                |
| Many maintainers need rich media                              | Direct-upload and image-storage pipeline                 |
| Users return to save/compare tools                            | Bookmarks, collections, then compare                     |
| Manual ranking becomes unreliable                             | Explicit editorial workflow, then quality/ranking models |

## Release close-out template

At the end of every release, add a short note here or in its issue:

- What shipped and its deployment version.
- What was deliberately not shipped.
- Migration and rollback/forward-fix note.
- Known limitations and the evidence needed to prioritise the next release.
- Test commands and manual smoke steps that passed.
