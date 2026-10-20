# Skeleton layout audit

Measured the loaded application with Playwright Chromium before resizing the
placeholders. The baseline contains 63 route/state samples at 1440 × 900,
768 × 900, and 390 × 900 CSS pixels. Measurements use `getBoundingClientRect()`
after fonts load. The runtime used real authenticated sessions, the real API,
and synthetic catalog data in a disposable database schema through `test:scoped`.

## Route coverage

- `/`: populated results, empty search, and page two; three, two, and one card
  columns at the measured viewport widths.
- `/categories`: directory heading, introduction, and category groups.
- `/categories/$`: populated and empty categories, cold navigation, delayed
  results, search, sorting, and pagination.
- `/$slug`: ordinary and long titles/descriptions, screenshots, missing media,
  statistics, error, retry, and not found.
- `/activity`: timeline heading and commit cards with different message lengths.
- `/submit` and `/auth/sign-in`: loaded forms and guest/authenticated guards.
- `/bookmarks` and `/submission`: headings, populated tables, pagination, and
  expanded/collapsed workspace geometry.
- `/projects`, `/projects/create`, and `/projects/$id/edit`: table, form columns,
  editor area, preview, and empty/selected category controls.
- `/admin/categories`, `/admin/categories/create`, and
  `/admin/categories/$id/edit`: table and distinct create/edit form layouts.
- Edit & Resubmit dialog: populated feedback and inputs, plus delayed loading at
  all three widths.

Machine responses (sitemaps, robots, Open Graph images, and badges) do not render
UI skeletons. Screenshot loading already reserves its 16:9 media area. Button
spinners and bookmark-action fallbacks retain their controls rather than replacing
the page layout.

## Measurements applied

- Project card bodies: **204px**, inside **208px** link wrappers. The old pending
  boxes were 192px. Skeletons now use the same Card parts, 28px title/logo row,
  40px tagline area, 16px statistics rows, padding, and responsive grid as the
  rendered cards. The default results page reserves 12 cards.
- Public results: removed the pending-only vertical padding and visible status
  line. At desktop, the first card now starts at exactly the loaded card's
  position, including on category pages.
- Project detail: replaced the unrelated three-card grid with the real 2.1:1
  article/statistics columns, 32px gap, 88px top inset, compact/desktop header
  heights, and responsive 16:9 media area. The fixture's statistics card and
  skeleton both measure **320 × 341px** at desktop.
- Table heads: **40px**. Bookmarks/submission rows: **49px**. Standard admin rows:
  **53px**. Their pending tables use the same table primitives and container
  padding; bookmarks and submissions respect the requested page size.
- Category forms: corrected an **8px** pending header offset. Shared Field
  primitives preserve the measured label, input, textarea, help, and grid sizing.
  Create and edit category routes now have their own form pending states.
- Category combobox: **32px** control, **8px** help gap, and naturally wrapping
  help text, instead of a standalone 40px rectangle. The presentation component
  is shared by the real query wrapper and the browser regression checks.
- Project edit form: preserves the main/360px preview columns, measured initial
  field positions, 256px editor reservation, and media aspect ratio.
- Resubmit dialog: pending and loaded dimensions match for the measured feedback
  and form data: **576 × 473.5px** at desktop/tablet, and **348 × 621.75px** at
  mobile. The old pending state was a short text message.
- Category directory and activity: use their own typography, content offsets,
  group/timeline structure, and responsive columns instead of generic cards or
  an empty route boundary.

Loading announcements remain available through visually hidden outputs; the
placeholder shapes are hidden from assistive technology.

## Category loading correction

Cold category navigation exposed an observer cancellation: the category header
observed the same in-flight query as the loader, so its Suspense unmount could
cancel the loader request. The header now reads committed route data and retains
that identity while new result data loads. It shows pending controls for a new
category path and keeps the existing search control mounted during filtering.
The regression suite covers both cold navigation and keyboard focus retention.

## Verification and local evidence

- `vp check`: formatting, lint, and type checks.
- `vp run typecheck`: all eight workspace TypeScript projects.
- `vp test run`: 1087 passed, one skipped across the repository during the audit.
- Final web unit suite: 355 passed, including all 59 public route tests.
- `vp run test:browser`: nine passed, including six new geometry checks against
  real rendered cards and category controls at the measured viewport/form widths.
- `vp run --filter web build`: production client and SSR build.
- Controlled error/retry and guest-guard browser checks passed. No horizontal
  document overflow occurred in the 63 baseline samples; wide admin tables scroll
  within their table containers.

Run the geometry regression suite with `vp run test:browser`. For the complete
web unit suite with the repository's disposable database and environment setup:

```sh
vp run --filter @altstack/db test:scoped -- vp run --filter web test:unit
```

The ignored `.skeleton-audit.local/` directory contains the one-off measurements
and screenshots: `before-measurements.json`, `after-transitions.json`,
`verified-category-transitions.json`, `after-modal-measurements.json`, and
`state-checks.json`. Intermediate transition samples taken while source files
were changing are superseded by the focused final verification records.

## Limits

Unknown content length, result count, category ancestry, optional media, and
history points can change the final page height. Cold skeletons reserve the
measured standard structure and page size; they cannot predict every data-driven
height. Empty results, long text, and missing media were measured separately and
retain their existing loaded layouts.
