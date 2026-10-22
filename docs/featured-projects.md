# Featured Projects

Implements the revised R7 scope: admin-curated discovery on **project detail
pages**, with no homepage changes. Latest catalogue sorting still uses project
creation time; this feature does not change publication dates or rankings.

## Curation

Admins open **Featured Projects** in the sidebar at `/admin/featured`. Search
published projects, add up to **21**, move entries up/down, remove entries, then
**Save changes**. Editing the selection is local until Save; removing an entry
does not remove the project. The project name links to its existing admin editor.

Save replaces the global ordered selection transactionally. It requires distinct
existing projects that are published, have repository data, and have an absolute
HTTP(S) website without embedded credentials. An unavailable saved project stays
visible to admins for cleanup and must be removed before another save.

The API compares the ordered `expectedProjectIds` to the current selection under
a shared transaction advisory lock. Concurrent or stale saves return `409`
without overwriting another admin's choices. The editor retains local changes
after failure; **Discard changes and reload** explicitly loads the latest list.

## Public detail

`project.getBySlug` adds `featuredProjects` containing only `id`, `slug`, `name`,
`logo`, `tagline`, `websiteUrl`, `stars` and `forks`. Published visibility, current
website eligibility and required repository data are checked in the same
read-only snapshot as the source project. The source project is excluded. This
is a global curated list, not category recommendations or a trending ranking.

- At the existing two-column breakpoint (`md`, 768 px), the panel starts below
  GitHub statistics. Stats scroll normally; Featured becomes sticky 68 px from
  the viewport top, beneath the header, and stops at the sidebar boundary.
- Below 768 px, Featured appears after Copy link/Share buttons and before the
  statistics, without sticky positioning. One panel is rendered for all sizes.
- If no eligible entries remain, the panel is omitted and statistics retain
  their previous sticky behavior.
- Each logo is a named 44 px website link opening a new tab with
  `noopener noreferrer`. A touch/click goes directly to the external website.
- Pointer hover reuses `ProjectHoverCard` from public Markdown mentions, showing
  name/logo/tagline and stored stars/forks. Its **View project details** link
  continues to open the internal public route. Logo failures use the existing
  fallback; previews can extend beyond the icon grid without clipping.

Only admins can read or replace the full curated selection through
`admin.featured.list` / `admin.featured.update`. REST mappings are
`QUERY /admin/featured-projects` and `PUT /admin/featured-projects` under
`/api/reference`. Guest requests return `401`, non-admin sessions `403`.
The admin route remains private/no-store and noindex under existing policies.

## Storage and rollout

Migration **`20261022030458_featured-projects`** adds `featured_projects` with
project FK/primary key, a unique integer position, and a 0–20 position check.
Deleting a project cascades its selection entry; unpublishing or removing its
website immediately excludes it from fresh public reads while retaining the
admin selection. The migration does not update existing projects or feature
anything automatically.

Apply `vp run db:migrate` **before** deploying the matching API/web: public detail
reads query the new table. Roll back application images while leaving the
additive table intact. The implementation does not migrate the shared application
database or production, deploy images, or verify production rollout.

## Verification

Database checks use only disposable schemas in `altstack_development`:

```sh
vp install
vp check
vp run typecheck
vp run --filter @altstack/db test:scoped -- vp test run
NODE_ENV=production vp run -r build
vp run --filter web test:browser
vp run --filter web test:featured-http
```

The API suite covers RPC/REST authorization before storage, bounded/distinct
input, eligibility, ordering/removal, concurrent first saves, public filtering,
self-exclusion, preview field privacy, database constraints and deletion cleanup.
Route tests cover admin guards, explicit save, reorder/remove, errors and reload.
Browser tests measure responsive geometry, sticky handoff/footer limits, touch
target sizes, existing hover previews and external/internal link destinations.
HTTP acceptance uses real synthetic sessions and production-built API/SSR against
a disposable schema, including unchanged homepage and private admin responses.
The HTTP script builds with `NODE_ENV=production`; use `--skip-build` only after
an explicitly production-mode build when the local `.env` sets development mode.

Local verification on **2026-10-22**, from baseline `dc447b8` plus the feature
working tree:

- `vp check`: passed with zero formatting, lint or type errors/warnings.
- Root disposable-schema suite: **1,157 passed, 1 skipped** across 83 files.
- Chromium browser suite: **15 passed**, including six new Featured layout and interaction cases.
- Typecheck and production build: **8/8 workspace tasks** each.
- HTTP acceptance: real guest/user/admin sessions, private admin SSR, persistence,
  stale-save conflict, published-only/self-excluding previews, external website
  links and unchanged homepage passed.
- T3 browser QA: admin add/reorder/remove/save/search, mobile admin table containment,
  light/dark detail rendering, hover preview, 68 px sticky handoff, mobile-after-share
  positioning and empty-selection statistics fallback passed.

The skipped integration is opt-in live Upstash. These checks do not verify a
merged release revision or production rollout. QA servers and disposable schemas
were cleaned up; application data in the shared schema was not reset.
