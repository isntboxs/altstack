---
# Product Requirements Document
## AltStack
Version: 1.1 (Phased)
Status: Draft
---

# Overview

## What is AltStack?

AltStack is a modern platform for discovering, exploring, and showcasing open-source software.

It helps developers find quality projects while giving maintainers a place to present their work to thousands of developers.

Unlike traditional directories, AltStack focuses on project discovery, quality, curation, and developer experience.

---

# Vision

Become the best place to discover modern open-source software.

Think:

- GitHub × Product Hunt × OpenAlternative

without becoming another software listing website.

---

# Mission

Help developers discover software they'll actually use.

Help maintainers get visibility.

Create an ecosystem around open-source projects.

---

# Problem

Today developers discover software from:

- GitHub
- Reddit
- Twitter/X
- Hacker News
- Product Hunt
- Awesome Lists

The experience is fragmented.

GitHub isn't designed for discovery.

Product Hunt isn't focused on open-source software.

Awesome Lists become outdated.

Most directories are static and ugly.

---

# Solution

A beautiful platform where developers can

- discover software
- compare projects _(v1.1)_
- browse by category
- follow trending projects
- submit their own project
- save favorites _(v1.1)_
- build collections _(v1.1)_

> Phasing note: `compare`, `favorites`, `collections` are v1.1 (post-MVP) to keep MVP focused. See [Phased MVP Roadmap](#phased-mvp-roadmap) and `docs/roadmap.md`.

---

# Target Users

## Explorer

Developers looking for tools.

Examples

- "Need auth library"
- "Need AI framework"
- "Need deployment platform"

---

## Builder

Open-source maintainers.

Goals

- showcase project
- get users
- collect feedback
- increase GitHub visibility

> MVP roles: Builder = `User` who has claimed/submitted a project. No separate `Maintainer` role in MVP (see [Roles](#roles)).

---

## Curators _(v1.1)_

People creating lists. Deferred to v1.1 with Collections.

Examples

Best AI Coding Tools

Best Self-Hosted Apps

Best React Libraries

---

# Goals

## Phased MVP Roadmap

Final MVP = Discover + Search + Filter + View project + Submit project (with moderation) + GitHub Auth + Claim/Edit + Admin moderation + Curated Home Feed.

MVP is split into 5 incremental, shippable phases (Opsi A — ultra-lean). Each phase is independently deployable and ends with a demoable vertical slice (DB → oRPC → UI).

Detailed execution plan, DB/API/UI tasks, and acceptance criteria: `docs/roadmap.md`.

### Phase 1 — Discovery Skeleton (Foundation + Read-Only)

**Goal:** Prove the core value: browse projects.

Included

- Fix baseline schema (`project` status, indexes, relations)
- Seed data (10-15 projects)
- `GET /projects` list (only `published`) + pagination
- `GET /projects/:slug` detail (minimal header + description + links)
- Public homepage grid + project page read-only (no auth, no search)

Success: Guest can browse list & detail. Build & migration pass.

Out of scope: Search, categories, submit, auth.

### Phase 2 — Search, Filter & Categories

**Goal:** Make discovery usable.

Included

- `category` + `project_category` (many-to-many), optional `tag` / topics array
- PostgreSQL Full-Text Search (generated `tsvector` on `name`, `tagline`, `shortDescription`)
- `GET /projects/search?q=&category=&sort=` (instant search, combinable filters)
- UI: search input (debounced), category chips, sort select (Latest/Oldest/Name/Most Stars etc.), URL-synced search params
- No Meilisearch yet (Future)

Success: Instant search <300ms, category + sort combinable, shareable URL.

Out of scope: Submit, auth, moderation, cron sync.

### Phase 3 — Submit Project + Moderation States

**Goal:** Allow anyone to add projects, safely.

Included

- `POST /projects/submit` — required: `repositoryUrl`, `tagline`, `shortDescription`, `logoUrl`, `categories`; optional `websiteUrl`, `content`
- Validation (GitHub URL regex, length 80/280), deduplication `repositoryUrl` unique → `409`, rate limit unauthenticated `10/IP/hour` → `429`
- Auto-fetch on submit (now, not cron): `stars`, `forks`, `license`, `owner`, `topics` via Octokit; graceful fallback if API limited
- Publication states: `Draft → Published | Rejected | Removed`
  - Draft: pending moderation, not listed publicly
  - Published: approved, publicly listed
  - Rejected: refused with reason; can edit & resubmit
  - Removed: delisted for policy violation
- Unauthenticated submissions → always `Draft`. Authenticated submissions attributed via `submitterId` but still `Draft` until admin approval (admin may bypass in future, not MVP)
- Guest may submit without account; authenticated bypasses IP rate limit

Success: Guest & User can submit; duplicate & rate-limited requests correctly rejected; Drafts hidden from public list.

Out of scope: Edit/claim (Phase 4), admin UI (Phase 5, but API approve/reject already here for testing), cron sync.

### Phase 4 — Authentication, Claim Ownership & Edit Own Submission

**Goal:** Let maintainers own their listing.

Included

- GitHub OAuth via Better Auth (email+password already enabled, GitHub is MVP auth)
- `POST /projects/:id/claim` — verify `octokit.rest.repos.get` (`permissions.admin` or `owner === user`)
- `PATCH /projects/:id` — only `submitterId` or claimed owner (`User` role)
- Editable fields for owner: `screenshots`, `description`, `links`, `videos`, `categories`
- Session handling via Better Auth; `User` vs `Admin` only

Success: User logs in with GitHub → claims own repo → edits listing; non-owners get `403`.

Out of scope: Role `Maintainer`/`Moderator` (mapped to `User`/`Admin`), impersonation, collections/bookmark.

### Phase 5 — Curated Home Feed & Admin Moderation (Final MVP Cap)

**Goal:** Close the loop — curation + moderation makes the platform operable.

Included

- Home feed sections: `Trending`, `New`, `Recently Updated`, `Editor's Picks` (featured flag)
- `Fast Growing` / `Most Starred` = sorted queries over `stars`/`updatedAt` (no Quality Score yet)
- Admin Dashboard (minimal, `apps/dashboard`):
  - List `Draft` submissions → Approve / Reject (with reason) / Remove
  - Feature/unfeature projects (`featured` boolean)
  - Manage categories (CRUD)
- Audit log (minimal, append-only): `submission create/update/approve/reject/remove`, `login/logout/failed login` (other events v1.1)
- Access control final:
  - Guest: submit, view published
  - User: submit, claim, edit own
  - Admin: all above + approve/reject/remove, feature, manage categories, manage roles/bans/sessions

Success: Admin can approve Draft → Published appears in feed; audit log records moderation; homepage shows 4 curated sections.

### After MVP — v1.1 and Beyond

Deferred to keep MVP lean:

- Collections, Bookmark (Favorites/Wishlist/Currently Using/Want To Try), Compare (`Coolify vs Dokploy` etc.)
- Quality Score / AltStack Score (7 factors)
- `Hidden Gems`, `Community Picks` feeds
- Cloudflare R2 / Images full integration (MVP uses `logoUrl` string)
- Meilisearch
- Cron GitHub Sync (MVP only auto-fetches on submit; v1.1 adds periodic refresh)
- Newsletter, RSS, API/SDK, Browser/VSCode/CLI extensions, AI Recommendations
- Developer Profiles, Follow Maintainers, Reviews/Ratings

---

Future (post-Phased MVP)

Become the homepage for discovering open-source software.

---

# Core Features (by Phase Tag)

Tags: `[P1]` Phase 1, `[P2]` Phase 2, `[P3]` Phase 3, `[P4]` Phase 4, `[P5]` Phase 5, `[v1.1]` Post-MVP.

---

## Discover

Homepage `[P1]` → `[P5]` enriched.

Sections

- Trending `[P5]`
- New `[P5]` (`[P1]` as simple `Most Recent` list)
- Editor's Picks `[P5]` (featured flag)
- Recently Updated `[P5]`
- Fast Growing `[v1.1]` (needs growth calc; MVP uses `Most Starred` fallback)
- Most Starred `[P5]`

---

## Search

Search by `[P2]`

- project name
- description
- tags / topics
- maintainer (via owner field)
- company (via owner field, if applicable)

Instant search (debounced, PG FTS). `[v1.1]` Meilisearch.

---

## Categories

Examples `[P2]`

- AI
- Developer Tools
- Productivity
- Design
- Database
- DevOps
- Monitoring
- Security
- CMS
- Self-Hosted
- Backend
- Frontend
- Mobile
- CLI

Implementation: `category` table + `project_category` join. Seed in `[P2]`, Admin CRUD in `[P5]`.

---

## Collections `[v1.1]`

Deferred. Example

Best Open-Source AI Apps

Best Authentication Solutions

Awesome Self-Hosted Apps

Modern React Ecosystem

---

## Project Page

Contains

Header `[P1]`

Logo

Name

Description (`tagline` + `shortDescription`)

Website

GitHub

License (auto-fetched `[P3]`)

Categories `[P2]`

Tags / Topics (auto-fetched `[P3]`)

---

Overview `[P1]` → `[P4]` editable by owner

Screenshots `[P4]` (owner editable, MVP stores URL string)

Video `[P4]`

Features (from `content` markdown) `[P1]`

Installation (from `content`) `[P1]`

Tech Stack (from topics) `[P3]`

Alternatives `[v1.1]`

Similar Projects `[v1.1]`

Maintainer `[P4]` (claimed user)

Contributors `[v1.1]` (needs GitHub contributors fetch)

Stats `[P1]` minimal → `[P3]` auto-fetched

---

GitHub Stats (stored in `GithubRepository` 1-1, Phase 1: `owner/repo/stars/forks` only)

Stars `[P1]` seeded, `[P3]` auto-fetch on submit (githubRepository.stars)

Forks `[P1]` seeded, `[P3]` (githubRepository.forks)

Watchers `[v1.1]` (cron, githubRepository.watchers)

Issues `[v1.1]`

Contributors `[v1.1]`

Last Commit `[v1.1]` (cron)

License `[v1.1]` (was `[P3]`, deferred — githubRepository.license)

Created `[P3]` (from GitHub `created_at`, project.createdAt)

Updated `[P3]`

---

Links

Website `[P1]`

GitHub `[P1]`

Discord `[P4]` (owner editable)

Docs `[P4]`

Demo `[P4]`

Twitter `[P4]`

Blog `[P4]`

---

## Submit Project `[P3]`

Anyone can submit.

Required

- GitHub Repository
- Website (optional)
- Description (`tagline` 80 chars, `shortDescription` 280 chars)
- Logo (`logoUrl`)
- Categories

System auto-fetches to `GithubRepository` (on submit, not cron in MVP)

- stars → `githubRepository.stars`
- forks → `githubRepository.forks`
- owner/repo → `githubRepository.owner`/`repo`
- README (stored in `project.content` if available, else truncated)
- license/topics → deferred to v1.1 (`githubRepository.license`, `topics`)

Cron refresh is v1.1 (updates `githubRepository.stars/forks` etc.).

Authentication

- Authentication is not required to submit (guests may submit without an account)
- Authenticated submissions are attributed to the account (`submitterId`) and bypass the unauthenticated IP rate limit, but still start as `Draft` until admin approval

Unauthenticated submissions

- Rate limit: 10 submissions per IP per hour, beyond which HTTP 429 (`TOO_MANY_REQUESTS` in `packages/api/src/contracts/base.ts`) is returned
- Deduplication: 1 submission per repository URL, regardless of submitter → `409 CONFLICT`
- Moderation: all submissions start in Draft and require admin approval before public listing
- Publication states: Draft → Published | Rejected | Removed
  - Draft: pending moderation review, not listed publicly
  - Published: approved and publicly listed
  - Rejected: refused with reason; submitter may edit and resubmit
  - Removed: delisted for policy violation; re-submission requires fixing the issue

Access matrix (MVP — only Guest/User/Admin; `User` who claimed = maintainer, `Admin` covers moderator duties)

| Action                                | Guest | User | Admin |
| ------------------------------------- | ----- | ---- | ----- |
| Submit project                        | ✓     | ✓    | ✓     |
| Claim ownership                       | ✗     | ✓    | ✓     |
| Edit own submission                   | ✗     | ✓    | ✓     |
| Approve / reject / remove submissions | ✗     | ✗    | ✓     |
| Feature projects                      | ✗     | ✗    | ✓     |
| Manage categories                     | ✗     | ✗    | ✓     |
| Manage roles, bans, sessions          | ✗     | ✗    | ✓     |

> Previous 5-role matrix (Maintainer/Moderator) collapsed to 3 roles for MVP. See [Roles](#roles).

Audit log — minimal MVP (required events) `[P5]`

- login, logout, failed login
- submission create / update / approve / reject / remove

Full audit (ownership claim, role change, ban/unban, impersonation, session revocation) is v1.1.

Session termination — minimal MVP `[P4]`

- Password change or ban invalidates all active sessions of the account

Full matrix (role change invalidation, admin revoke any session, impersonation flag) is v1.1.

Impersonation is v1.1 (Admin-only, logged, flagged).

---

## Claim Ownership `[P4]`

Maintainer (any `User`) logs in with GitHub.

Verifies ownership via GitHub API (`permissions.admin` or `repo owner === user`).

Can edit

- screenshots
- description
- links
- videos

---

## Bookmark `[v1.1]`

Deferred to v1.1. Users save favorite software.

Collections

Favorites

Wishlist

Currently Using

Want To Try

---

## Compare `[v1.1]`

Deferred to v1.1.

Example

Coolify vs Dokploy

Supabase vs Appwrite

Clerk vs Better Auth

Feature comparison table.

---

# Quality Score `[v1.1]`

Deferred. Instead of only GitHub Stars.

AltStack Score

Calculated from

- Stars
- Growth
- Recent Releases
- Issue Activity
- Documentation
- Community
- Contributors
- Maintenance

MVP uses simple `stars`/`updatedAt` sorting as proxy.

---

# Home Feed

MVP `[P5]`: Trending, New, Recently Updated, Editor's Picks.

v1.1 adds: Fast Growing, Community Picks, Hidden Gems.

| Feed             | Phase | Logic (MVP)                       |
| ---------------- | ----- | --------------------------------- |
| Trending         | P5    | `stars` desc + `updatedAt` recent |
| New              | P5    | `createdAt` desc                  |
| Recently Updated | P5    | `updatedAt` desc                  |
| Editor's Picks   | P5    | `featured = true` (admin curated) |
| Fast Growing     | v1.1  | stars growth delta (needs cron)   |
| Most Starred     | P5    | `stars` desc                      |
| Community Picks  | v1.1  | votes/bookmarks                   |
| Hidden Gems      | v1.1  | low stars + high quality score    |

---

# Authentication

MVP `[P4]`: GitHub OAuth + Email/Password (already enabled via Better Auth).

Future (v1.1+): Google, etc.

Better Auth config in `packages/auth/src/server/config.ts`. Social provider `github` already enabled.

---

# Roles

MVP roles: `Guest`, `User`, `Admin` only.

| Role  | Description                                         | Phase |
| ----- | --------------------------------------------------- | ----- |
| Guest | Unauthenticated visitor; can view & submit          | P1-P3 |
| User  | Authenticated via Better Auth; can claim & edit own | P4    |
| Admin | Full moderation, featuring, category & user mgmt    | P5    |

Previous `Maintainer` and `Moderator` roles are collapsed:

- `Maintainer` → `User` who has claimed a project (no separate role)
- `Moderator` → `Admin` (admin covers approval duties in MVP)

Defined in `packages/shared/src/schemas/role.ts` (`ROLES = ['admin','user']`) and `packages/auth/src/server/permissions.ts`. Add `moderator`/`maintainer` in v1.1 if needed.

---

# Admin Dashboard `[P5]` (MVP minimal)

Approve submissions

Reject spam (with reason)

Manage categories (CRUD)

Feature projects (`featured` flag)

Audit log (read-only, minimal events)

Analytics `[v1.1]`

Manage collections `[v1.1]`

---

# Tech Stack

## Runtime & Toolchain

- Bun

- Vite+ (`vp`)

---

## Frontend

- React 19

- TanStack Start & TanStack Router

- TanStack Query

- TailwindCSS v4

- packages/ui: `@base-ui/react` for runtime components, shadcn for component tooling

---

## Backend

Runtime boundaries

- apps/dashboard, apps/web: TanStack Start with Nitro

- apps/server: Elysia

Shared

- oRPC

- Drizzle ORM

- PostgreSQL (via `pg`)

---

## Search

- PostgreSQL Full-Text Search (MVP `[P2]`)

- Meilisearch (Future `v1.1`)

---

## Authentication

- Better Auth

---

## File Storage `[v1.1]`

- Cloudflare R2 (MVP uses `logoUrl` string; R2 upload in v1.1)

---

## Image Optimization `[v1.1]`

- Cloudflare Images (MVP uses direct URL)

---

## Deployment

- Docker

- Coolify

- Dokploy

---

# Database

Core Models

```text
[MVP — Phase 1-5]
User              // Better Auth, role admin|user
Session / Account / Verification // Better Auth
Project           // + status, featured, submitterId, rejectionReason, moderatedAt/By
GithubRepository  // 1-1 strict: projectId unique FK → project.id, owner, repo, stars, forks (Phase 1: 4 fields only)
Category
ProjectCategory   // join
Tag (or topics text[] on Project) — P2
AuditLog          // P5 minimal

[v1.1 — Post-MVP]
Collection
CollectionProject
Bookmark
Review
Vote
ProjectImage (screenshots gallery, replaces logoUrl string with R2)
Maintainer (if separate role reintroduced)
Release           // GitHub releases (if split from GithubRepository)
GithubRepository extra fields: license, topics text[], watchers, openIssues, lastCommitAt, etc.
```

Relations in `packages/db/src/relations.ts`:

- `project.submitter` currently `from: r.project.id` → must be `from: r.project.submitterId → r.user.id`
- Add `project.githubRepository` 1-1 strict `from: r.project.id → r.githubRepository.projectId (unique)` and inverse `githubRepository.project`

---

# Future Features (v1.1+)

Deferred from MVP to reduce overwhelm:

- Collections / Bookmark / Compare
- Quality Score / AltStack Score
- Cron GitHub Sync (auto-refresh stars, releases, contributors)
- Developer Profiles
- Follow Maintainers
- Reviews / Ratings
- Roadmaps
- API / Public SDK
- Browser Extension / VSCode Extension / CLI
- Newsletter / Trending Weekly / Launches / RSS
- AI Recommendations
- Analytics (admin)
- Impersonation (admin, logged & flagged)
- Full audit log (role change, ban/unban, impersonation, session revocation)
- Session admin revocation & impersonation-aware termination
- File Storage (R2) & Image Optimization (Cloudflare Images) full

---

# Non Goals

Not another GitHub.

Not another Product Hunt.

Not another package manager.

Not another social media.

---

# Success Metrics

Global (final MVP)

- Number of projects (published)
- Monthly active users
- Search usage
- Submitted projects
- Claimed projects
- Returning visitors
- Average session duration

Per-phase (see `docs/roadmap.md` for detailed acceptance):

- P1: list/detail render with seed data, no errors
- P2: search latency <300ms, 0 empty-state bugs on combinable filters
- P3: submit success rate, 429/409 correct, auto-fetch coverage >95%
- P4: claim success, 403 on non-owner edit, GitHub OAuth completion rate
- P5: moderation throughput (Draft→Published <24h), featured coverage, audit log completeness

---

# Long-Term Vision

AltStack becomes the place developers open when they think:

> "i need a tool for this."

Instead of searching Google or GitHub first, they search AltStack.

---
