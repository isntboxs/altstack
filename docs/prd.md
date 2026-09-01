---
title: AltStack Product Requirements
version: 2.0
status: Draft — lean delivery plan
last_updated: 2026-09-01
---

# AltStack

## Product summary

AltStack is a curated directory for open-source software. It helps developers answer one practical question: **“What open-source tool should I try for this job?”**

The first product is intentionally a small, trustworthy catalogue—not a social network, marketplace, or GitHub replacement.

## Problem

Developers discover tools through GitHub, posts, launch sites, and old “awesome” lists. The result is fragmented and difficult to filter. Maintainers also lack a simple, focused place to present a project.

## Target users

- **Explorer:** wants to browse and narrow a set of open-source tools.
- **Maintainer:** wants a correct public listing for a GitHub repository.
- **Admin:** keeps the catalogue useful by reviewing submissions.

“Curator” is deliberately not an MVP role. Curated collections are a later feature, after the catalogue has enough useful projects.

## Product principles

1. **One useful loop at a time.** A release must make one user journey complete.
2. **Manual operations before automation.** Do not introduce jobs, queues, extra search infrastructure, or image storage until usage proves the need.
3. **Truthful labels.** “Most starred” is not “trending”; a project is not “recently updated” unless its source data is refreshed.
4. **Server-side authorization is authoritative.** UI route guards improve navigation only; every private or mutating API procedure must enforce its own permission check.
5. **Measured performance, not speculative infrastructure.** PostgreSQL and its full-text search are the default. Measure production-like data before adding Meilisearch, Redis, or a scheduler.

## Launch definition

The first public launch is complete when a visitor can:

1. Browse a small, curated set of published projects.
2. Open a project page and reach its GitHub repository or website.
3. Search by words, filter by category, sort, and share the resulting URL.
4. Sign in with GitHub and submit a repository for review.
5. Have an admin approve or reject that submission.

Claiming ownership, editing, featured projects, and curated feed sections are valuable, but are **MVP+**. They must not block the first launch.

## Explicit non-goals for launch

- Collections, bookmarks, comparisons, reviews, ratings, follows, profiles, and social activity.
- “Quality score”, “Hidden gems”, “Fast growing”, or any other derived ranking.
- Cron-based GitHub refresh, queues, webhooks, or background workers.
- Guest submission and anonymous-IP rate limiting.
- File upload, Cloudflare R2, Cloudflare Images, or a gallery.
- Meilisearch, analytics dashboards, newsletters, extensions, SDKs, or public APIs.
- A standalone multi-role moderation system. Launch has only `user` and `admin` database roles.

## Release map

Each release is independently deployable. Target size is one focused vertical slice (normally 1–3 solo development days), not a sprint-sized bucket.

| Release             | User outcome                                                  | Depends on |
| ------------------- | ------------------------------------------------------------- | ---------- |
| R0 — Catalogue data | A reliable set of seed projects exists                        | —          |
| R1 — Browse         | Anyone can list and open published projects                   | R0         |
| R2 — Find           | Anyone can search, filter, sort, and share results            | R1         |
| R3 — Sign in        | A GitHub identity is available where needed                   | R1         |
| R4 — Submit         | Signed-in users can submit a repository as `draft`            | R2, R3     |
| R5 — Moderate       | An admin can publish or reject drafts                         | R4         |
| R6 — Own & edit     | Verified maintainers can claim and update a listing           | R5         |
| R7 — Curate         | Admins can feature projects; public sees simple curated lists | R5         |

R0–R5 is the launch scope. R6–R7 should be scheduled only after launch feedback.

## Functional requirements

### R0 — Catalogue data

- Store 12–20 real, manually curated projects.
- Every seed project has a name, unique slug, tagline, short description, logo URL, repository URL, optional website URL, Markdown content, and status `published`.
- Repository metadata consists only of canonical GitHub owner/repository, stars, and forks. It may be seeded manually.
- Seed data must be safe to run repeatedly and must not overwrite a real user submission.

### R1 — Browse

- `GET /projects` returns only `published` projects, newest first, with pagination.
- `GET /projects/:slug` returns a published project or a generic `404`.
- Homepage shows a project grid. Detail shows the project’s identity, description, GitHub link, website link when present, Markdown content, stars, and forks.
- Draft, rejected, and removed projects never appear in public responses.

### R2 — Find

- Users can use a text query, one category, a sort order, and pagination together.
- Supported initial sort orders: newest, oldest, name, most starred, most forked.
- The home route validates `q`, `category`, `sort`, and `page`. Default values are omitted from shared URLs where practical.
- Navigating one filter preserves the others and resets `page` to 1. Only these four values are loader dependencies.
- PostgreSQL full-text search indexes name, tagline, and short description. Topics, maintainer, and company search are deferred until those data models exist.

### R3 — Sign in

- GitHub OAuth is the only sign-in path required by the product. Existing email/password support may remain available, but it is not a launch requirement.
- A protected page uses a route guard for UX and a protected server/API procedure for data access. The API is the security boundary.
- Sign-in return URLs must be validated as local relative paths to prevent open redirects.

### R4 — Submit

- Only a signed-in GitHub user can submit during launch. This avoids anonymous spam, IP storage, and rate-limit infrastructure before there is evidence it is needed.
- Required input: repository URL, tagline, short description, logo URL, and 1–3 existing categories. Website and Markdown content are optional.
- Canonical GitHub repository URL is unique. A duplicate returns `409 CONFLICT`.
- The service looks up the repository once and stores owner, repository, stars, and forks. If GitHub is temporarily unavailable, the submission fails with a retryable message; do not publish incomplete metadata.
- A submission is created in `draft`, linked to its submitter, and is not public.
- No README import, license, topics, screenshots, videos, or cron refresh in this release.

### R5 — Moderate

- An admin can list drafts, approve, or reject with a required reason.
- Moderation may start with a protected internal page or a minimal dashboard route. A full dashboard, category CRUD, and analytics are not requirements.
- Every moderation mutation writes a minimal audit event: actor, project, action, optional rejection reason, and timestamp.
- A newly approved project appears in public browse and search immediately.
- The original submitter can correct a rejected submission through the submission form. That action atomically returns it to `draft`; this is not the general owner-editing feature in R6.

### R6 — Own & edit (MVP+)

- A user may claim an unclaimed listing only with a linked GitHub account.
- Claim verification must use that user’s GitHub access token or another user-specific authorization mechanism. A server token’s repository permissions must never be treated as the user’s permissions.
- For the first version, accept either GitHub repository owner or an explicitly verified admin collaborator; define one policy and test it.
- The verified owner can edit approved listing content and categories. An edit to a published listing stays published unless an admin later introduces a re-review policy.

### R7 — Curate (MVP+)

- Admin can set `featured` on a published project.
- Public homepage may show **Most Starred**, **Recently Added**, and **Editor’s Picks**.
- Do not call any static or one-time-fetched ranking “Trending” or “Recently Updated”. Those require history or a refresh job.

## Project lifecycle

| State       | Public? | Who can act           | Valid next states                              |
| ----------- | ------- | --------------------- | ---------------------------------------------- |
| `draft`     | No      | Admin                 | `published`, `rejected`                        |
| `published` | Yes     | Admin                 | `removed`                                      |
| `rejected`  | No      | Submitter, then admin | submitter edits → `draft`; admin may `removed` |
| `removed`   | No      | Admin                 | none in launch scope                           |

The transition from `rejected` to `draft` happens atomically when the submitter makes a valid re-submission. Rejected records retain the prior reason for the submitter until that transition; removed records are immutable to users.

## Roles and access

| Action                           | Visitor | User               | Admin   |
| -------------------------------- | ------- | ------------------ | ------- |
| Browse/search published projects | Yes     | Yes                | Yes     |
| Submit a project                 | No      | Yes, GitHub linked | Yes     |
| View own draft/rejected project  | No      | Yes                | Yes     |
| Approve/reject/remove            | No      | No                 | Yes     |
| Claim/edit listing               | No      | R6 only            | Yes     |
| Feature a project                | No      | No                 | R7 only |

`Maintainer` describes a claimed owner, not a separate database role. `Moderator` is not needed while `admin` handles moderation.

## Data model boundaries

Keep domain tables small and additive:

- `project`: public copy, canonical repository URL, status, submitter, optional owner, moderation fields, timestamps.
- `github_repository`: one repository per project; owner, repository name, stars, forks, and fetch timestamps.
- `category` and `project_category`: reusable category taxonomy and many-to-many membership.
- `audit_log`: moderation events only in R5.

Add a unique database constraint for canonical repository URL and `github_repository.project_id`. Add a unique `(owner, repo)` constraint for the repository identity. Do not introduce a generic tag table, score table, image table, or background-job table before their releases demand them.

## Technology choices

- React, TanStack Start/Router/Query, Tailwind, and shared UI package.
- oRPC contracts and Drizzle with PostgreSQL.
- PostgreSQL full-text search for launch; add Meilisearch only after measured search quality or latency requires it.
- Better Auth with GitHub OAuth.
- Direct image URLs for launch; storage/upload pipeline later.

## Success signals

Review signals after R5 rather than pre-optimising them:

- At least 20 accurate published listings.
- A visitor can successfully complete browse, search, and detail-page journeys.
- All authenticated submissions reach a terminal moderation decision.
- Moderation takes less than one business day while volume is small.
- No authorization bypass is found in direct API tests for owner/admin actions.

## Later backlog

Only prioritise these after observing launch behaviour:

- Claim/edit polish, featured sections, and category management.
- Guest submission with durable rate limiting and abuse controls.
- GitHub refresh via scheduler/webhooks, additional repository metadata, and true trending.
- Images, screenshots, video, collections, bookmarks, compare, quality score, analytics, newsletter/RSS, profiles, reviews, API/SDK, and extensions.
