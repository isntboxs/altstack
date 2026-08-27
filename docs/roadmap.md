# AltStack Roadmap — Phased MVP to Final MVP

> Companion to `prd.md` (v1.1 Phased). This doc is the execution plan. PRD is the _what_; this is the _how, in what order, and when it's done_.

**Decisions locked (Opsi A):**

- Collections / Bookmark / Compare → **v1.1** (post-MVP)
- Roles → **Guest / User / Admin** only (`Maintainer` = `User` who claimed, `Moderator` = `Admin`)
- GitHub sync → **auto-fetch on submit now**, **cron refresh v1.1**
- Stack: PG FTS for MVP, Meilisearch/R2/Images deferred

---

## Overview — 5 Phases → Final MVP

```
Phase 1 ── Discovery Skeleton (Foundation + Read-Only)
   │
Phase 2 ── Search, Filter & Categories
   │
Phase 3 ── Submit + Moderation States
   │
Phase 4 ── Auth, Claim & Edit Own
   │
Phase 5 ── Curated Home Feed & Admin Moderation  ──►  FINAL MVP
   │
   └─ v1.1 ── Collections, Bookmark, Compare, Quality Score, Cron, etc.
```

Each phase is **vertical** (DB → Drizzle → oRPC contract → router → TanStack Start UI) and **shippable**. No phase leaves `main` broken.

**Branch strategy:** `feat/phase-1-discovery` → PR → merge, repeat. Keep `project.status` migrations forward-compatible from Phase 1.

---

## Phase 1 — Discovery Skeleton (Foundation + Read-Only)

**Goal:** Prove core value — browsing projects works without auth/search/submit.

**Why first:** Unblocks UI, routing, and DB shape with minimal risk. Everything else builds on `project` table.

### DB (`packages/db`)

- [ ] Fix `packages/db/src/relations.ts:40-54` — `project.submitter` currently `from: r.project.id`, fix to `from: r.project.submitterId → r.user.id`; add `project ↔ githubRepository` 1-1 (`project.id → githubRepository.projectId unique`)
- [ ] Migrate `packages/db/src/schemas/project.ts` (no GitHub columns — stats moved to `githubRepository`):
  ```ts
  status: pgEnum('project_status', [
  	'draft',
  	'published',
  	'rejected',
  	'removed',
  ])
  	.notNull()
  	.default('draft')
  featured: boolean('featured').default(false).notNull()
  rejectionReason: text('rejection_reason')
  moderatedAt: timestamp('moderated_at')
  moderatedBy: uuid('moderated_by').references(() => user.id)
  // indexes
  index('project_status_idx').on(table.status)
  index('project_featured_idx').on(table.featured)
  ```
- [ ] Create `packages/db/src/schemas/github.ts` — `githubRepository` (1-1 strict `projectId unique`, Phase 1 only `owner/repo/stars/forks`):
  ```ts
  export const githubRepository = pgTable(
  	'github_repositories',
  	{
  		id: uuid('id')
  			.default(sql`gen_random_uuid()`)
  			.primaryKey(),
  		projectId: uuid('project_id')
  			.notNull()
  			.unique()
  			.references(() => project.id, { onDelete: 'cascade' }),
  		owner: text('owner').notNull(),
  		repo: text('repo').notNull(),
  		stars: integer('stars').notNull().default(0),
  		forks: integer('forks').notNull().default(0),
  		createdAt: timestamp('created_at').notNull().defaultNow(),
  		updatedAt: timestamp('updated_at')
  			.notNull()
  			.defaultNow()
  			.$onUpdate(() => new Date()),
  	},
  	(t) => [
  		index('github_repo_owner_repo_idx').on(t.owner, t.repo),
  		index('github_repo_project_idx').on(t.projectId),
  	]
  )
  // v1.1 will add: license, topics text[], watchers, openIssues, lastCommitAt, etc.
  ```
- [ ] Update `packages/db/src/schemas.ts` to export `project`, `github`, `auth`; update `packages/db/src/relations.ts` with `project.githubRepository` 1-1 strict
- [ ] Seed: `packages/db/src/seed.ts` (or `drizzle/seed`) — 15 projects covering categories AI, DevTools, Productivity, etc., all `published`; insert `project` then `githubRepository` (left join) with varied `stars` 50–15000 / `updatedAt` spread for feed testing
- [ ] Fix `packages/shared/src/schemas/role.ts:3` docs — confirm `ROLES = ['admin','user']` stays (no maintainer/moderator yet)

### API (`packages/api`)

- [ ] Contract `packages/api/src/contracts/project.ts` (new):
  - `listProjects`: input `{ page, limit, status? }` → output `Project & GithubRepository` flattened (`stars/forks` from `githubRepository` join) + `total`
  - `getProjectBySlug`: input `{ slug }` → output `Project & GithubRepository` (left join, `stars/forks` nullable if not yet fetched)
- [ ] Router `packages/api/src/routers/project.ts`:
  - `list` filters `status = 'published'` by default, `orderBy createdAt desc`, pagination 12/page; query via `db.query.project.findMany({ with: { githubRepository: true } })` or explicit `LEFT JOIN github_repositories`
  - `getBySlug` left join `githubRepository`, with `404 NOT_FOUND` if draft/rejected for guest
- [ ] Register in `packages/api/src/routers/index.ts` + `contracts/index.ts`

### UI (`apps/web`)

- [ ] `apps/web/src/routes/index.tsx` — replace static `HeroSection`+`FilterSection` with `ProjectGrid` (uses `orpc.project.list`), `ProjectCard` (logo, name, tagline, stars/forks from `githubRepository`)
- [ ] `apps/web/src/routes/projects.$slug.tsx` — new detail route (`createFileRoute('/projects/$slug')`), fetch `getProjectBySlug`, layout: header (logo+name+tagline), links (GitHub/website), markdown `content`, stats (`stars/forks` from `githubRepository` join)
- [ ] `apps/web/src/utils/orpc.ts` — add query options helpers for new routes (flattened `stars/forks`)
- [ ] Keep `HeroSection`/`FilterSection` as visual shell but not functional yet (search input disabled with `Coming in Phase 2` tooltip)

### Acceptance Criteria

- [ ] `GET /projects` returns only `published` for guest; `GET /projects/:slug` for draft returns 404 to guest, 200 to admin (later)
- [ ] Homepage renders 12 cards from seeded DB, pagination works, no N+1
- [ ] Detail page renders all header fields from `prd.md:232-252` minimal set
- [ ] `vp run -r build` + `vp check` pass, `db:push` idempotent
- [ ] Relation bug fixed — `project.submitter` resolves to `user` correctly in Drizzle query

### Out of Scope

Search, categories, submit, auth, admin, GitHub fetch, audit log

### Dependencies

None. Unblocks all later phases.

### Effort

0.5–1 sprint (solo). Mostly wiring.

---

## Phase 2 — Search, Filter & Categories

**Goal:** Make discovery usable — instant search + browsable categories.

### DB

- [ ] New file `packages/db/src/schemas/category.ts`:
  ```ts
  export const category = pgTable('category', {
  	id: uuid('id').defaultRandom().primaryKey(),
  	name: text('name').notNull().unique(),
  	slug: text('slug').notNull().unique(),
  	description: text('description'),
  	createdAt: timestamp('created_at').defaultNow().notNull(),
  })
  export const projectCategory = pgTable(
  	'project_category',
  	{
  		projectId: uuid('project_id')
  			.references(() => project.id, { onDelete: 'cascade' })
  			.notNull(),
  		categoryId: uuid('category_id')
  			.references(() => category.id, { onDelete: 'cascade' })
  			.notNull(),
  	},
  	(t) => [primaryKey({ columns: [t.projectId, t.categoryId] })]
  )
  ```
- [ ] Add to `packages/db/src/schemas.ts` exports + `relations.ts` (category ↔ project many-to-many)
- [ ] Add FTS column to `project`:
  ```ts
  // generated tsvector for PG FTS
  searchVector: text('search_vector') // or use `tsvector` type via sql`to_tsvector(...)`
  // alternative: create GIN index via raw SQL migration:
  // CREATE INDEX project_fts_idx ON projects USING GIN (to_tsvector('english', name || ' ' || tagline || ' ' || short_description));
  ```
  Simpler MVP: no stored column, just `WHERE to_tsvector(...) @@ plainto_tsquery(...)` + GIN index via `drizzle-kit` custom SQL.
- [ ] Seed categories (12 from `prd.md:184-213`) + assign 1-3 per seeded project
- [ ] Optional: `topics: text('topics').array()` or `text('topics')` JSON for tags; MVP can store `topics` as `text[]` fetched later in Phase 3, but schema added here

### API

- [ ] New contracts:
  - `searchProjects`: input `{ q?: string, categorySlug?: string, sort?: 'latest'|'oldest'|'name-asc'|'name-desc'|'most-stars'|'most-forks', page?: number, limit?: number }`
  - `listCategories`: no input → `Category[]`
- [ ] Router logic:
  - If `q` present: `WHERE to_tsvector('english', name || ' ' || tagline || ' ' || short_description) @@ plainto_tsquery('english', q)` with `ts_rank` ordering when `sort` not specified
  - `categorySlug` → join `projectCategory` + `category`
  - `sort` mapping: `latest → createdAt desc`, `oldest → asc`, `name-asc/desc`, `most-stars → stars desc`, `most-forks → forks desc`
  - All queries still `status='published'` for guest
  - Add `category` eager load for cards

### UI

- [ ] Make `apps/web/src/components/filter-section.tsx:30-57` functional:
  - `InputGroupInput` → controlled, debounced 250ms, updates `search` URL param (`?q=`) via `useNavigate` + `loaderDeps`
  - `Select` → updates `sort` param, items from `selectItems` already defined
  - Category filter: new `CategoryChips` component (horizontal scroll, active state), writes `category` param
- [ ] Update `apps/web/src/routes/index.tsx` loader to read `search` params (`validateSearch` with Zod), prefetch `searchProjects` with `loaderDeps` for cache key
- [ ] Empty state: "No projects found for '{q}' in {category}" + clear filters CTA
- [ ] Loading: skeleton cards, `pendingMs: 200` to avoid flicker

### Acceptance Criteria

- [ ] Typing in search updates URL (`?q=auth`) and results without full reload; debounce works; back/forward restores state
- [ ] `q=supabase category=database sort=most-stars` returns ranked, filtered results; PG `EXPLAIN` shows GIN index used
- [ ] Category chips + sort + search are combinable (3-way filter)
- [ ] All existing P1 tests still pass; new contract has Zod validation
- [ ] Seed data searchable — `q=AI` returns AI projects even if query matches description not just name

### Out of Scope

Submit, auth, moderation, GitHub live fetch, pagination beyond 12/page

### Dependencies

Requires Phase 1 `project` + `githubRepository` (1-1) tables + seed.

### Effort

1 sprint. FTS GIN index is the riskiest part — test on local PG.

---

## Phase 3 — Submit Project + Moderation States

**Goal:** Let anyone add projects, safely — the write path.

This is the largest MVP phase; it closes the `Goals MVP: Submit project` loop.

### DB

- [ ] Ensure `project` columns from Phase 1 exist: `submitterId`, `status`, `rejectionReason`, `moderatedAt/By` (no `githubOwner/Repo/stars/forks` in `project` — moved to `githubRepository`)
- [ ] Ensure `githubRepository` table exists (Phase 1: `owner`, `repo`, `stars`, `forks`, `projectId unique` 1-1)
- [ ] Add submission metadata to `project`:
  ```ts
  submitterIp: text('submitter_ip') // for rate limit audit, nullable for authed
  submittedAt: timestamp('submitted_at').defaultNow().notNull()
  // repositoryUrl already unique, ensure index exists
  ```
- [ ] No new tables yet besides `githubRepository` (audit log in Phase 5)

### API

- [ ] Contract `submitProject`:
  ```ts
  input: z.object({
    repositoryUrl: z.string().regex(/^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/),
    websiteUrl: z.string().url().optional().or(z.literal('')),
    tagline: z.string().min(10).max(80),
    shortDescription: z.string().min(20).max(280),
    logoUrl: z.string().url(),
    content: z.string().max(10000).optional(),
    categorySlugs: z.array(z.string()).min(1).max(3),
  })
  output: z.object({ id: z.string().uuid(), slug: z.string(), status: z.enum(['draft']) })
  errors: { BAD_REQUEST:400, CONFLICT:409, TOO_MANY_REQUESTS:429 }
  ```
- [ ] Router `submitProject` handler:
  1. **Dedup** — `SELECT id FROM projects WHERE repositoryUrl = $1` → if exists, throw `CONFLICT` (`packages/api/src/contracts/base.ts:25-27` already has `CONFLICT`)
  2. **Rate limit** — if `!ctx.user` (guest), check `Map<ip, number[]>` in-memory sliding window (10/hour). If exceeded, throw `TOO_MANY_REQUESTS` (`base.ts:29-31`). Authed bypasses IP limit but still deduped. Future: Redis.
  3. **Parse owner/repo** from `repositoryUrl`
  4. **Auto-fetch** GitHub: `octokit.rest.repos.get({ owner, repo })` → `stargazers_count`, `forks_count`. Use `packages/api/src/github.ts` Octokit instance. Wrap in try/catch — if 404 → `BAD_REQUEST` "Repository not found", if 403 rate limited → store 0 and log warning, don't fail submission.
  5. **Slug** — `slugify(name)` + check unique, append `-2` if needed
  6. **Insert** — in transaction: `INSERT project` (`status='draft'`, `submitterId`, `submitterIp`) → `INSERT githubRepository` (`projectId`, `owner`, `repo`, `stars`, `forks` from GitHub or 0) — 1-1 strict `projectId unique`
  7. **Return** `{ id, slug, status: 'draft' }`
- [ ] Add `getIp` helper in `packages/api/src/context.ts` (from `x-forwarded-for` or `request.ip`)
- [ ] Add `publicProcedure` variant with optional auth (guest allowed) — check `packages/api/src/procedures.ts` current `publicProcedure` vs `protectedProcedure` split

### UI

- [ ] New route `apps/web/src/routes/submit.tsx` (`createFileRoute('/submit')`):
  - Form with `zod` + `react-hook-form` (or `tanstack/form`), fields as per input schema, category multi-select (max 3, from `listCategories` query)
  - Client validation mirrors server Zod
  - Submit → `orpc.project.submit.mutate`, on success show "Submitted! Pending moderation" with link to homepage (draft not yet visible) and CTA "Submit another" / "Sign in to track your submissions" (P4 upsell)
  - Error handling: 409 → "This repository already submitted — view existing project", 429 → "Too many submissions, try again in {retryAfter}", 400 → field errors
- [ ] Update `HeroSection` buttons (`apps/web/src/components/hero-section.tsx:50-58`) to `Link to="/submit"` and `Link to="/" hash="#projects"`
- [ ] Update `Header` to include "Submit" nav item

### Acceptance Criteria

- [ ] Guest can submit valid repo → row created `status=draft`, not visible in `GET /projects?status=published`, `stars` populated from GitHub (mocked in test with MSW)
- [ ] Submitting same `repositoryUrl` twice → 409 regardless of guest/user
- [ ] 11th guest submission from same IP within hour → 429
- [ ] Authed user 11th submission → not 429 (bypass), but still 409 if duplicate
- [ ] Invalid GitHub URL or non-existent repo → 400 with helpful message
- [ ] `categorySlugs` with 0 or 4 categories → 400
- [ ] Form is accessible, works without JS? (progressive enhancement nice-to-have, not blocking)

### Out of Scope

Claim/edit (P4), admin approve UI (P5 — but API for approve exists for manual testing via `psql`), audit log, cron

### Dependencies

Requires P1 DB + P2 categories (or create categories inline if P2 not done — but P2 should be done first). Octokit env `GITHUB_TOKEN` must be set.

### Effort

1–1.5 sprints. Rate limit + GitHub fetch error handling is the polish.

---

## Phase 4 — Authentication, Claim Ownership & Edit Own Submission

**Goal:** Let maintainers prove ownership and curate their listing.

### Auth (`packages/auth` + `apps/web`)

- [ ] Confirm `packages/auth/src/server/config.ts:62-67` — `github` provider enabled, `encryptOAuthTokens: true` good
- [ ] Verify `packages/auth/src/client.ts` exports `authClient` with `signIn.social({ provider: 'github' })` + `signOut`, `useSession`
- [ ] UI — `apps/web/src/components/auth-dialog.tsx`:
  - Already exists; ensure it calls `authClient.signIn.social({ provider: 'github', callbackURL: '/' })` with `callbackURL` from current route
  - Add `AuthDialog` trigger in `Header` (`apps/web/src/components/header.tsx`): show `UserAvatar` + dropdown (Profile, My Submissions, Sign Out) when `session.data`, else "Sign in" button
- [ ] Middleware `apps/web/src/middlewares/auth-middleware.ts` — ensure session is available in `__root.tsx` loader via `getAuth` (`apps/web/src/functions/get-auth-fn.ts`)
- [ ] Roles stay `admin|user` in `packages/shared/src/schemas/role.ts:3` — no new role; claim logic uses `userId` check, not role

### DB

- [ ] No schema change — `project.submitterId` already links submitter; claim will update it or add `claimedBy`? Simpler MVP: **claim = transfer `submitterId` to claimer if verification passes and current `submitterId` is null or guest**. If already owned, only owner/admin can edit — claim fails with 409.
- [ ] Alternative: add `ownerId: uuid('owner_id').references(() => user.id)` separate from `submitterId` to preserve submitter history. Recommend adding `ownerId` nullable in this phase to avoid ownership confusion.
  ```ts
  ownerId: uuid('owner_id').references(() => user.id)
  claimedAt: timestamp('claimed_at')
  ```

### API

- [ ] Contract `claimProject`: input `{ projectId: uuid }` → output `{ success: boolean }`, errors `401 UNAUTHORIZED`, `403 FORBIDDEN` (not owner), `404 NOT_FOUND`, `409 CONFLICT` (already claimed)
- [ ] Router `claimProject` (protected — requires `ctx.user`):
  1. Fetch `project` + `user` (with `account` where `providerId='github'` to get GitHub username? Better: `user.username` or `account.accountId` for GitHub login)
  2. Parse `githubOwner/Repo` from project
  3. Call `octokit.rest.repos.get({ owner, repo })` — check if `data.owner.login === githubUsername` OR `data.permissions?.admin === true` (requires user's GitHub token — available via `account.accessToken` if `encryptOAuthTokens` false? With `true`, need to decrypt — Better Auth handles; check `account.accessToken` availability in session)
  4. If verified, `UPDATE project SET ownerId = ctx.user.id, claimedAt = now() WHERE id = $1`
  5. If not verified → `403 FORBIDDEN` with "Verification failed — you are not the repository owner"
- [ ] Contract `updateProject`: input `{ projectId: uuid, tagline?, shortDescription?, content?, logoUrl?, websiteUrl?, categorySlugs? }` (owner-editable subset)
- [ ] Router `updateProject` (protected):
  - Guard: `project.ownerId === ctx.user.id OR project.submitterId === ctx.user.id OR ctx.user.role === 'admin'` else `403`
  - If `categorySlugs` provided, replace `projectCategory` rows in transaction
  - Update `updatedAt`, return updated project
- [ ] Contract `listMySubmissions`: input void, protected → returns `Project[]` where `submitterId === ctx.user.id OR ownerId === ctx.user.id`, includes `draft`/`rejected` statuses so user sees pending

### UI

- [ ] `apps/web/src/routes/projects.$slug.edit.tsx` — new route, loader checks `project` + `ctx.user` (via `beforeLoad` auth check, redirect to `/` with toast if not owner). Form prefilled, same validation as submit but fewer required fields.
- [ ] `apps/web/src/routes/my.submissions.tsx` — table of user's submissions with status badges (Draft/Published/Rejected/Removed), "Edit" link, "View" link if published
- [ ] Detail page (`projects.$slug.tsx`) update: if `project.ownerId === session.user.id` show "You own this project — Edit" banner; if guest viewing draft via direct slug, still 404 (no leak)
- [ ] Claim button on detail page: "Claim ownership" (visible to authed user if `!ownerId`), calls `claimProject`, on success shows confetti/toast + banner
- [ ] Show stars/forks from `githubRepository` join (not `project` columns)

### Acceptance Criteria

- [ ] Guest visiting `/projects/my` → redirect to sign-in dialog
- [ ] User A submits repo `X`, User B tries to claim `X` (not owner) → 403
- [ ] Owner logs in via GitHub, claims `X` → `ownerId` set, now can edit; non-owner edit attempt → 403
- [ ] Owner edits `tagline` → change visible immediately on detail page
- [ ] `listMySubmissions` returns drafts for owner, but guest `listProjects` still hides drafts (both via join to `githubRepository` for stars/forks)
- [ ] GitHub OAuth flow works end-to-end (test with real GitHub app in dev, mock in CI)

### Out of Scope

Admin moderation (P5), audit log, impersonation, multiple owners

### Dependencies

Requires P3 `project` + `githubOwner/Repo` populated. Needs `GITHUB_CLIENT_ID/SECRET` + `BETTER_AUTH_URL/SECRET` env.

### Effort

1 sprint. GitHub token scoping (`repo` read) is the gotcha — document required scopes.

---

## Phase 5 — Curated Home Feed & Admin Moderation (Final MVP Cap)

**Goal:** Make the platform operable — curation drives discovery, admin makes moderation sustainable. After this, MVP is _done_.

### DB

- [ ] Ensure `project.featured` boolean exists (P1)
- [ ] New `auditLog` table (minimal MVP):
  ```ts
  export const auditLog = pgTable(
  	'audit_log',
  	{
  		id: uuid('id').defaultRandom().primaryKey(),
  		actorId: uuid('actor_id').references(() => user.id),
  		action: text('action').notNull(), // 'submission.create' | 'submission.approve' | 'submission.reject' | 'submission.remove' | 'auth.login' | 'auth.logout' | 'auth.failed_login'
  		targetId: text('target_id'), // project id or user id
  		targetType: text('target_type'), // 'project' | 'user' | 'session'
  		metadata: jsonb('metadata'), // { rejectionReason, ip }
  		createdAt: timestamp('created_at').defaultNow().notNull(),
  	},
  	(t) => [
  		index('audit_log_action_idx').on(t.action),
  		index('audit_log_created_idx').on(t.createdAt),
  	]
  )
  ```
- [ ] No other tables — `Category` CRUD already, `featured` flag covers Editor's Picks

### API

- [ ] Contracts:
  - `listTrending`: `limit?` → `Project[]` sorted `stars desc` (MVP proxy for trending; v1.1 will add `stars` delta)
  - `listNew`: `limit?` → `createdAt desc`
  - `listRecentlyUpdated`: `limit?` → `updatedAt desc`
  - `listFeatured`: `limit?` → `where featured=true` + `updatedAt desc`
  - `moderateProject`: input `{ projectId: uuid, action: 'approve'|'reject'|'remove', reason?: string }` — admin only, errors `401`/`403`
  - `setFeatured`: input `{ projectId: uuid, featured: boolean }` — admin only
  - `listPendingSubmissions`: admin only → `Project[]` where `status='draft'` + pagination
  - `manageCategory`: `createCategory`, `updateCategory`, `deleteCategory` — admin only (if not already from P2)
- [ ] Router guards: check `ctx.user.role === 'admin'` via `packages/auth/src/server/permissions.ts` `ac` (add `admin` statement if needed). Return `403 FORBIDDEN` for non-admin.
- [ ] `moderateProject` handler:
  - `approve`: `UPDATE project SET status='published', moderatedAt=now(), moderatedBy=ctx.user.id WHERE id=$1 AND status='draft'` + insert `auditLog` row `submission.approve`
  - `reject`: requires `reason`, `status='rejected'`, `rejectionReason=reason` + audit `submission.reject`
  - `remove`: `status='removed'` + audit `submission.remove` (for published projects violating policy)
  - All writes in transaction + audit insert
- [ ] `auth` hooks: on `signIn`/`signOut`/`failed` create audit rows (Better Auth `hooks` in `createAuthConfig()`)

### UI — `apps/web` (public feed)

- [ ] Update `apps/web/src/routes/index.tsx`:
  - Keep `HeroSection` at top
  - Add 4 sections below `FilterSection`:
    - `Trending` — horizontal carousel or 6-card grid from `listTrending`
    - `New` — `listNew`
    - `Recently Updated` — `listRecentlyUpdated`
    - `Editor's Picks` — `listFeatured` (empty state: "No picks yet")
  - Each `ProjectCard` links to detail; section header has "View all" → filtered search (e.g., Trending → `/?sort=most-stars`)
  - Data fetched via `loader` + `useSuspenseQuery` with `staleTime` 60s

### UI — `apps/dashboard` (admin)

- [ ] Routes in `apps/dashboard/src/routes/`:
  - `/` — dashboard overview: counts `draft`/`published`/`rejected`, recent audit log
  - `/submissions` — table of `listPendingSubmissions` with columns `name | repo | submitter | submittedAt | actions (Approve/Reject)`. Reject opens dialog requiring reason. All actions call `moderateProject` + toast.
  - `/projects` — all projects with `featured` toggle (calls `setFeatured`), status badge
  - `/categories` — CRUD table for categories (calls `manageCategory`)
  - `/audit` — read-only table of `auditLog` (paginated, filter by `action`)
- [ ] Guard `apps/dashboard/src/routes/__root.tsx` `beforeLoad`: if `!session || session.user.role !== 'admin'` → redirect to `web` app sign-in with "Admin only"
- [ ] Reuse `packages/ui` components (`@base-ui/react` + shadcn) already in `apps/dashboard/package.json`

### Acceptance Criteria

- [ ] Homepage shows 4 sections with real data from seeded + submitted projects; each section has ≤6 cards, correct sort
- [ ] Guest submits `Draft` → not in any homepage section until admin approves; after `approve` → appears in `New` + `Recently Updated` immediately
- [ ] Admin rejects with reason `Spam` → `status=rejected`, visible to submitter in `My Submissions` with reason, not in public list; submitter can edit & resubmit? (MVP: resubmit = update + admin re-approve; no auto re-draft on edit — document behavior)
- [ ] Admin toggles `featured` → project appears in `Editor's Picks`
- [ ] Non-admin hitting `moderateProject` → 403
- [ ] Audit log shows `submission.create` (from P3, retroactively inserted or from now on), `submission.approve/reject`, `auth.login` rows with actor + target
- [ ] `apps/dashboard` accessible only to `admin`, all tables paginated, no 500s on empty state

### Out of Scope (v1.1)

Collections, bookmark, compare, Quality Score, cron GitHub sync, R2/Images, Meilisearch, newsletter, analytics, impersonation, full session revocation matrix

### Dependencies

Requires P1-P4. Needs `admin` user seeded (`role='admin'`) for testing.

### Effort

1–1.5 sprints. Dashboard is mostly CRUD, but audit log wiring + homepage sections need polish.

---

## v1.1 — Post-MVP Backlog (Not MVP, but Planned)

| Feature                        | Why deferred                         | Rough scope                                                |
| ------------------------------ | ------------------------------------ | ---------------------------------------------------------- |
| Collections & Bookmark         | Needs user lists, not core discovery | `collection`, `collection_project`, `bookmark` tables + UI |
| Compare (`Coolify vs Dokploy`) | Needs comparison engine, matrix      | `compare` view + `feature` schema                          |
| Quality Score (7 factors)      | Needs cron + heuristics              | `project_score` materialized view, weighted calc           |
| Cron GitHub Sync               | Needs scheduler (BullMQ / pg_cron)   | Nightly `stars/forks/issues/contributors` refresh          |
| R2 + Cloudflare Images         | Needs upload flow, signing           | `project_image` table, presigned URL                       |
| Meilisearch                    | Needs infra                          | Replace PG FTS, typo tolerance                             |
| Full audit log                 | More events                          | `roleChange`, `ban`, `impersonation` etc.                  |
| Impersonation                  | Security-sensitive                   | Admin-only, flagged sessions                               |
| Analytics                      | Needs event tracking                 | Page views, search analytics                               |
| Newsletter / RSS               | Content pipeline                     | `launch`, `trending weekly`                                |

---

## Cross-Cutting Concerns

### Auth & Roles

- Better Auth `adminPlugin` already in `packages/auth/src/server/config.ts:48-53` with `adminRoles: ['admin']`. Keep `ROLES = ['admin','user']` until v1.1.
- Map `Maintainer` → `User` (check `ownerId`), `Moderator` → `Admin` for all guards. Document in `prd.md:382-403`.

### Error Handling

- Use `packages/api/src/contracts/base.ts` error map (`BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `CONFLICT`, `TOO_MANY_REQUESTS`, etc.) consistently. No ad-hoc `throw new Error`.

### Testing Strategy (per phase)

- **Unit:** Zod schemas, slug generation, rate-limit window, FTS query builder
- **Contract:** oRPC procedure tests with mocked DB (`drizzle-orm` + `pg-mem` or `docker postgres` via `docker-compose.yml` `postgres` service) + mocked Octokit (`msw` or `vi.mock`)
- **E2E (manual for MVP):** Playwright smoke — seed → browse → search → submit → claim → moderate → featured appears

### Env Checklist

```
DATABASE_URL
BETTER_AUTH_URL, BETTER_AUTH_SECRET
GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
GITHUB_TOKEN (for Octokit server-side, optional but recommended for rate limits)
CORS_ORIGINS
APP_NAME
```

### Definition of Done — Final MVP

- [ ] All P1-P5 acceptance criteria checked
- [ ] `prd.md:120-180` Goals (Discover/Search/Filter/View/Submit + Auth/Admin) demonstrable on `main` with seeded + live data
- [ ] No Collections/Bookmark/Compare code in `main` (kept to branch)
- [ ] `vp check` (fmt+lint) + `vp run -r test` + `vp run -r build` pass
- [ ] `docs/roadmap.md` updated with actual vs planned, known limitations listed (e.g., cron not yet)

---

## How to Use This Roadmap

1. Create issue per phase: `Phase 1 — Discovery Skeleton`, etc., link to this doc section.
2. Work phase-by-phase on `feat/phase-N-*` branches, PR must include DB migration + API contract + UI + acceptance checklist.
3. After each phase merge, tag `phase-1-done`, demo to stakeholders, collect feedback before next phase.
4. When Phase 5 merges, tag `mvp-1.0`, cut release, start v1.1 planning.

---

_Last updated: 2026-08-27 — Opsi A locked._
