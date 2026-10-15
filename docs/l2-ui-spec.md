# L2 — Public UI implementation brief

Research date: **2026-10-15, Asia/Jakarta**. AltStack baseline:
`be5059f84de44fd3d46ef22bbb343b49823c0d13` on `dev`.

This brief fills the implementation details for [L2 in the roadmap](roadmap.md#l2--finish-public-ui-affordances).
It combines live browser exploration of OpenAlternative, REA analysis of public
bundles, and inspection of the current AltStack source. **Research is complete;
the UI work and its release acceptance remain open.**

## Scope and decisions

Keep the existing launch outcome: every enabled action works and public copy
matches the shipped product. The recommended L2 treatment is to **remove**
unimplemented Verify, Bookmark, Report, Embed and account-menu Bookmarks.
Do not leave an empty More menu. A disabled treatment is an alternative only
when its unavailable state and explanation are accessible without hover.

OpenAlternative implements those actions with real workflows. Their contracts
are recorded below for future work; copying their buttons into AltStack would
also require those workflows. Ownership remains R6; bookmarks and reporting
remain the later backlog. L2 does not need a new API, migration, ownership
policy, email service, moderation queue or ranking algorithm.

Retain the implemented AltStack Offset Blocks identity, Inter typography,
theme tokens, categories, GitHub statistics/history, OAuth, submission and
resubmission behavior. There is no brand redesign or catalogue feature expansion.

## What the reference establishes

Evidence IDs OA-01 through OA-10 refer to the
[browser finding ledger](research/openalternative-l2/browser-observations.json).
Runtime observations and static inferences are deliberately separate.

- **OA-01 — Detail hierarchy:** the [Supabase listing](https://openalternative.co/supabase)
  exposes identity and description, a working website link, an actual screenshot,
  and repository/statistics. Its screenshot is a website link, rather than a
  second unrelated destination. Adopt the hierarchy and destination consistency.
- **OA-02 / OA-03 — Auth gates:** guest Verify and Save open a sign-in dialog.
  Verify also sets `dialog=verify` in the URL. Neither authenticated verification
  nor bookmark persistence was executed. L2 should hide AltStack's unavailable
  actions rather than send users through login to an unfinished feature.
- **OA-04 — Corrections:** [Report](https://openalternative.co/supabase?dialog=report)
  opens email, issue-type and message fields. Issue types cover broken links,
  incorrect categories, stale information and other feedback. Escape dismisses
  it, clears dialog query state and restores focus to Report. No report was sent.
- **OA-05 — Embedding:** [Embed](https://openalternative.co/supabase?dialog=embed)
  offers theme, width, height, badge preview, generated HTML and copy feedback.
  The defaults observed were light, 200 × 50. Copy displayed success feedback;
  clipboard contents and an external embedding were not inspected.
- **OA-06 / OA-07 — Mobile:** at a measured 390 × 844 CSS viewport, detail actions
  collapse into a named More menu. The navigation menu can open and navigate to
  [Categories](https://openalternative.co/categories). The corrected sequence
  succeeded; earlier clicks while the menu was closed are not a site defect.
- **OA-08 — Search recovery:** Control+K opens a command search. A sentinel query
  produces an explicit empty result; Escape closes it. This supports clear state
  feedback, not a requirement to add a command palette to L2.
- **OA-09 — Missing detail:** a nonexistent slug renders a clear not-found page
  with a home link. The rendered state was observed; HTTP status was not captured.
- **OA-10 — URL state:** homepage search writes `q` to the URL and Reset restores
  the homepage URL. Combined filter/history behavior and the homepage's exact
  empty-result copy were not conclusively captured.

REA also recovered static references to bookmark check/set, report creation,
and verification OTP send/confirm. These are evidence of client-side integration
points, **not proof of server authorization, delivery or persistence**. The OTP
approach must not replace AltStack's planned GitHub ownership policy by inference.

## Current AltStack gaps

These findings are source observations on the baseline commit, not a browser
acceptance run against the local AltStack app.

- [`$slug.tsx`](../apps/web/src/routes/_app/$slug.tsx): Verify/Bookmark/Report/Embed
  are enabled buttons or menu items without handlers. The Verify tooltip promises
  trust and higher ranking. The compact More trigger also lacks an explicit name.
- [`header.tsx`](../apps/web/src/components/header.tsx): account Bookmarks has no
  destination or handler. The user-avatar menu trigger has no explicit label.
  Mobile navigation already has an `Open navigation` label; keep it.
- [`hero-section.tsx`](../apps/web/src/components/hero-section.tsx): Explore
  Projects and the Introducing badge are buttons without actions. Supporting
  copy still promises comparison and trending feeds, which the PRD defers.
- Detail screenshot construction uses `https://placehold.co/1280x1024` when a
  website exists without a stored screenshot. Its alt text presents this generic
  placeholder as the project's actual website screenshot. No image-error fallback
  exists in the detail or catalogue card image rendering.
- [`project-list-section.tsx`](../apps/web/src/components/project-list-section.tsx):
  cards hardcode Last commit to Unknown and switch content only on hover.
  Remove the unused metric or use authoritative metadata already returned by the
  API; do not add a new data feature for this cleanup.
- Home and detail have no explicit route pending component. Root error and
  not-found fallbacks are plain, with no retry action. Category routes already
  have pending, error/retry and not-found components; extend their conventions.

## Implementation work packages

### L2-A — Honest actions and copy

Primary files: `hero-section.tsx`, `header.tsx`, `routes/_app/$slug.tsx`.

- Remove unfinished actions from desktop, compact/mobile, authenticated account
  menus and tooltips together. Remove separators/groups that become empty.
- Make Introducing a noninteractive badge/text. Make Explore Projects a real
  anchor to the catalogue section, with a stable section ID and scroll margin
  below the fixed header. Keyboard activation must reach the same section.
- Use the established supporting message: “Find quality projects, compare
  alternatives, and explore developer tools.” For launch UI, remove the comparison
  clause until the product supports it: “Find quality projects and explore
  developer tools.” Keep metadata/brand copy consistency in scope when applicable.
- Remove verification/ranking and trending claims from public UI. Retain factual
  Most Stars, Most Forks and Latest sorting; these are implemented sorts.
- Keep repository and optional website links. Their absence must not leave an
  inert Visit control or empty action wrapper.

Acceptance:

- [ ] Guests, members and admins see only actions with working destinations or
      handlers on desktop and mobile.
- [ ] No unfinished action survives in the account menu or a compact breakpoint.
- [ ] Explore Projects works with pointer and keyboard; Introducing is not a tab
      stop. No unsupported verification/ranking/compare/trending promise remains.

### L2-B — Screenshot and logo states

Primary files: detail route, catalogue cards; extract a shared image component
only if both consumers need the same behavior. Continue using `resolveFileUrl`.

The required detail state contract:

1. **Stored screenshot loads:** display the actual image with the established
   16:9 layout and project-specific alt text. Link it to the validated website
   only when a website exists; otherwise render it without a link.
2. **No stored screenshot:** show a compact, noninteractive message such as
   “No screenshot available.” Preserve the real website/repository CTAs elsewhere.
   Do not allocate a large fake image or call the message a screenshot.
3. **Stored image fails:** replace the broken image with “Screenshot unavailable.”
   Leave the rest of the listing and real links usable; no fallback retry loop.
4. **Image still loading:** reserve image space and keep optional media independent
   from the route loader. An image failure must not turn the listing into a 404.

For a missing/broken logo, retain the project name and show a local initials or
neutral geometric fallback. Decorative watermark/fallback images must not repeat
the project name in the accessibility tree. Reset a failure state when the image
source changes. Required publish-time logos can still fail at display time.

Acceptance:

- [ ] With/without screenshot × with/without website all render truthful states.
- [ ] Invalid or failed screenshot/logo URLs never display a broken-image glyph
      as the only identity or remove useful project content.
- [ ] No public screenshot request goes to `placehold.co`; fallback is local.
- [ ] New images, reloads and source replacements exit any old failure state.

### L2-C — Mobile and keyboard navigation

Primary files: header, filters, cards, detail layout, existing shared menu/dialog
components. Preserve their built-in keyboard behavior rather than reimplement it.

- Give every icon-only trigger a stable name, including user menu and any
  remaining detail menu. Tooltips supplement an accessible name.
- Verify Enter/Space activation, arrow-key menu navigation, Escape dismissal,
  focus return and visible focus. Closed menus must not leave hidden tab stops.
- Navigation links close the mobile menu. Keep role-dependent destinations:
  member Submission and admin Projects; preserve sign-in return-path behavior.
- Let long project titles, category paths and action rows wrap without pushing
  content beyond the viewport. Sticky headings must not cover the fixed header,
  dropdown/dialog layers or a focused control.
- Provide comfortable mobile hit areas; use 44 CSS px as the preferred target
  for compact icon controls. This is an AltStack design target, not an observed
  OpenAlternative property.
- Cards stay one semantic link. Key content and the details affordance must work
  with focus and touch, without hover-only discovery or duplicate hidden copy.
  Respect reduced-motion preferences when retaining decorative motion.

Acceptance:

- [ ] At 320, 390, 768 and 1280 CSS px, no horizontal overflow or overlapping
      identity/actions/header; long-name fixtures are included.
- [ ] A keyboard-only pass reaches navigation, search/reset/sort/category,
      project cards, pagination, external links and recovery controls.
- [ ] Menu/dialog open → keyboard interaction → Escape/close → correct focus
      return succeeds. Sign-in modal remains usable on a short mobile viewport.

### L2-D — Pending, empty, error and not-found recovery

Primary files: home/detail routes, `__root.tsx`, existing category state
components and filters. Reuse the current Query-backed loaders and URL helpers.

- Add visible home/detail pending states using TanStack route pending components
  and deliberate `pendingMs`/`pendingMinMs`. Categories already have one.
  A brief request should not flash a full skeleton unnecessarily.
- Distinguish empty catalogue, empty category, no search matches and an out-of-range
  page. Provide an appropriate clear-filters, browse or earlier-page action.
  Never label a failed request as zero results.
- Preserve usable search input while it updates. Avoid presenting an older result
  set as final for the newly selected query; announce pending/completed state
  without forcing focus away from the search field.
- Provide a coherent error state with Try again and a browse recovery link.
  Loader retries must invalidate the failed route/query data and actually refetch;
  merely resetting an error boundary is insufficient with an external cache.
- Keep resource-not-found separate from transport/server errors. Missing and
  draft/rejected/removed project slugs must stay indistinguishable publicly.
  Unknown paths and category resources also need usable recovery.
- Match the existing L1 HTTP status, canonical and indexing contracts when
  improving the rendered fallbacks. Do not use loader data in a not-found view
  that may be reached before the loader completes.

Acceptance:

- [ ] Delayed, empty, rejected and successful loader fixtures show the correct
      state; Try again recovers after the mock server becomes available.
- [ ] Search + category + sort + page survive reload and back/forward. Search,
      sort/category changes and reset retain their existing page-reset policy.
- [ ] Missing/nonpublic detail uses the same public message; an API outage uses
      the error state instead. No private feedback appears in either fallback.
- [ ] Pending/error status is announced accessibly; recovery controls retain
      visible focus and work on both theme modes.

### L2-E — Real links and factual card content

Primary files: detail route and catalogue cards; audit public content links too.

- Ensure website, repository and screenshot destinations match the current
  project. Website actions render only for an accepted HTTP(S) URL.
- Keep native anchors for navigation and external destinations. Use explicit
  `rel="noopener noreferrer"` when opening an external page in a new tab;
  communicate that behavior accessibly where useful.
- Category badges/breadcrumbs remain internal typed links. Pagination controls
  at their boundary must not act like enabled links or reset other filters.
- Remove the hardcoded Last commit card row unless available API metadata can
  supply it accurately. Existing statistics cold-start, gap and stale-data
  messages remain truthful; unavailable data must not become a fabricated zero.

Acceptance:

- [ ] Every enabled public link leads to its documented destination, including
      missing website and screenshot cases.
- [ ] Keyboard/touch cards expose useful information without hover; decorative
      images do not duplicate the link name.
- [ ] No metric claims fresh data or a comparison/ranking calculation it lacks.

## Future feature contracts captured from the reference

These are implementation seeds, **not additional L2 acceptance criteria**.
Shipping any one requires its own tested workflow before re-enabling its button.

### Verify / ownership — R6

Observed guest behavior: sign-in gate. Static reference: OTP send/confirm.
Authenticated behavior and server rules remain unverified.

For AltStack, use the roadmap's explicit GitHub maintainer-access policy and
user-specific credentials. Model `ownerId`/`claimedAt` separately from submitter
provenance. Handle unlinked accounts, insufficient access, already claimed and
concurrent claims, and verification-service errors. A verified badge describes
ownership only; do not promise a ranking boost. Successful ownership must unlock
authorized maintainer editing, not merely change an icon.

### Bookmark / saved projects — later backlog

Observed guest behavior: sign-in gate. Static reference: check and set procedures.

Use a unique user/project relationship, session-derived authorization, a toggle
with pending and failure recovery, and a private saved-project list linked from
the account menu. Specify handling of unpublished/deleted projects. Done means
save, unsave and reload persist for the correct account and other accounts cannot
read that list; an optimistic UI change alone is insufficient.

### Report / correction — later backlog

Observed behavior: a guest-accessible form with issue type, email and message.
Static reference: report creation; successful submission was not tested.

Before enabling AltStack Report, choose guest or signed-in intake, define typed
issue categories and bounded text, and provide durable storage plus an admin
review destination. Include submission pending, inline errors, duplicate-click
protection and success acknowledgement. Add abuse controls appropriate to that
chosen intake. Done means the report reaches a reviewable queue and can be
resolved; neither a mailto placeholder nor an unpersisted toast closes the work.

### Embed / public badge — optional later slice

Observed behavior: configurable badge preview and generated HTML with copy
feedback. A public `/<slug>/badge.svg` URL appears in the generated snippet.

For AltStack, design a badge using its existing brand, render it only for public
projects, and link to the canonical listing. Define light/dark variants, bounded
dimensions, escaped project names, unpublish behavior and caching. Provide a
readonly snippet and copied/failure feedback; test an embedding on a separate
fixture page. Badge inclusion does not assert verified ownership.

A plain Copy link/Share action is also a possible small future addition. It is
not necessary to remove today's dead controls, and must have success/failure
feedback and a canonical destination if selected.

## Implementation order and verification

1. L2-A removes misleading affordances and fixes hero destinations/copy.
2. L2-B adds real media states; L2-E verifies links and card data in the same pass.
3. L2-C verifies both breakpoints and keyboard behavior using real shared UI.
4. L2-D fills loader/recovery gaps and preserves existing search/SEO contracts.
5. Run the release checks and record browser acceptance on the implemented commit.

Useful fixture set: guest/member/admin; long name; screenshot present/absent/broken;
website present/absent/invalid; broken logo; zero results; page beyond the end;
delayed request; one failed request followed by success; missing/nonpublic slug.
Use controlled responses locally for failure states rather than assuming the
reference site's healthy page demonstrates them.

Focused regression targets are rendered detail/action/media behavior, hero
anchor activation, account/menu destinations, image-error recovery, real router
retry, combined URL/history filters and generic hidden-project 404 behavior.
Build on `category-catalog-ui`, `public-category-routes`, `seo`,
`github-statistics`, and submission navigation tests. Do not add tests that only
mirror static CSS/class choices.

Repository validation commands:

```bash
vp install
vp check
vp run --filter @altstack/db test:scoped -- vp test run
vp run -r build
```

For the implementation, also smoke the real app at desktop/mobile widths, with
keyboard only, light/dark themes and reduced motion. Root/workspace test results
and staging/OAuth acceptance are separate evidence. This research does not close
them or mark L2 done.

## Evidence and remaining boundaries

- [Evidence README](research/openalternative-l2/README.md): methods, REA IDs,
  source manifests, original local Evidence retention and rerun commands.
- [Runtime ledger](research/openalternative-l2/browser-observations.json): observed
  public interactions and exact limitations.
- [REA mobile extract](research/openalternative-l2/rea-mobile-extract.json):
  provider-owned Chromium scenario and action results, projected from the retained
  original Evidence and its requested accessibility tree.
- [REA static extract](research/openalternative-l2/rea-static-extract.json): syntax
  observations with source ranges and coverage. Four selected files, not a full
  backend/source reconstruction; semantic coverage remains partial/unknown.

No login/account creation, verification email, report submission, checkout or
production mutation was performed. Reference screenshot absence/failure, server
errors and slow loading were not observed live; their L2 behaviors above are
explicit AltStack recommendations. Full keyboard auditing and real mobile device
testing also remain implementation acceptance tasks.
