# L2 — Local implementation and acceptance

Validated on **2026-10-15–16, Asia/Jakarta**, in the supplied `feat/l2-public-ui`
worktree, based on `9e800f39d7102c59e622e4aa6d8113bf91c2566e`.
This is an uncommitted local implementation, not a merged/deployed revision.

The current application/test/asset diff is identified by
[the source manifest](research/l2-source-manifest.json):
`3991283cd0c84e83853249eebfbaa4a3ccec918b009de78569bd2ea063f068b8`.
The manifest retains the initial acceptance fingerprint
`3766f6a45db750b45c46a35b44d1af7b15b7fe2b2c9a8950bcd3bc718141eff7`
and its file hashes under `previousRevisions`. It hashes the base commit and
sorted changed-file byte hashes, excluding documentation to avoid self-reference.
Checks below distinguish the initial acceptance from the navigation follow-up;
later merges require their own checks.

## Implemented scope

- **L2-A:** Verify, Bookmark, Report and Embed remain on desktop and in a working,
  named compact More menu. Native disabled buttons/shared menu items prevent
  activation; “Coming soon” is visible without hover and accessible. Account
  Bookmarks follows that contract. Unsupported trust/ranking promises are gone.
  Introducing is text; Explore Projects is a native `#catalogue` anchor with
  focus transfer and fixed-header clearance.
- **L2-B:** real stored screenshots, independent of optional website; compact
  absence/failure states; reserved 16:9 loading space; no placeholder requests
  or image retry loops. Missing/broken logos use local decorative initials.
  Changing resolved sources resets failure state, including SPA navigation.
- **L2-C:** named triggers, existing shared keyboard/Escape/focus behavior,
  closing mobile navigation, role-specific destinations, full sign-in return
  paths, preferred 44 px compact controls and wrapping long names/categories.
  Cards have one native link and permanently visible information/details.
  Offset Blocks, local Inter and theme tokens remain in use. A final 320 px
  header check found pre-font-load overlap; compact padding/gap now keep brand
  and Submit separated in both fallback and loaded typography.
- **L2-D:** explicit home/detail/category pending views (250 ms delay, 200 ms
  minimum), persistent controls outside the leaf pending boundary, accessible
  pending/results feedback and hidden stale cards while new catalogue results
  are pending. Outgoing navigation preserves current cards until the destination
  takes over. Empty catalogue/category/filter and out-of-range states have recovery links. Retry
  marks Query data stale before invalidating Router and actually refetches.
  Errors remain distinct from empty results and generic missing/nonpublic detail.
- **L2-E:** accepted HTTP(S) websites, matching screenshot destinations, explicit
  `noopener noreferrer` for external new-tab anchors, typed category links and
  native disabled pagination boundaries. The fabricated card Last commit row
  is removed; detail snapshot/history cold-start and stale semantics remain.

Hero, site metadata and deterministic default OG copy now describe shipped
capabilities. `vp run --filter web generate:og` regenerated the default PNG;
its render was visually inspected and its offline deterministic regression passed.
No API feature, migration, ownership, bookmark persistence, report workflow,
embed endpoint, command palette, deployment, push or PR was added.

## Initial validation

These checks and the original browser ledgers apply to the initial fingerprint
`3766f6a45db750b45c46a35b44d1af7b15b7fe2b2c9a8950bcd3bc718141eff7`.

The [machine-readable validation record](research/l2-validation.json) includes
command exit codes, the tested fingerprint and retained screenshot hashes.

- `vp install`: passed in this worktree; lockfile unchanged.
- `vp check`: formatting, lint and types passed without warnings/errors.
- `vp run --filter @altstack/db test:scoped -- vp test run`: **947 passed,
  1 skipped** across 59 files (58 passed, 1 skipped).
- `vp run --filter @altstack/db test:scoped -- vp run -r test`: **945 passed,
  1 skipped** (shared 186; DB 98; API 426 + 1 skipped; web 235). Packages without
  tests exit successfully. Server has no package test script; root tests cover it.
- `vp run -r build`: passed. Existing dependency `use client`, chunk-size and
  Node color-environment warnings remain; application lint/type checks are clean.
- `vp run --filter web test:seo-http`: **11 acceptance groups passed** on cold
  packaged Node/Nitro with production-only dependencies: SSR HTTP/metadata,
  canonical/noindex, escaped JSON-LD, readable documentation, static/dynamic OG,
  image invalidation, sitemap/robots, redirects, privacy, outages and resources
  excluded from client JS. Evidence: `/home/mrboxs/.cache/altstack-l1-http-HxpMba`.
- Focused `vp test run apps/web/tests/public-category-routes.test.tsx`:
  **43 passed**. Media regressions add **6 tests**. Coverage includes presence
  **and** inactivity of desktop/compact actions and user/admin Bookmarks, hero
  focus, image failure/source changes, delayed-search focus, retry against fresh
  external cache, empty catalogue, out-of-range recovery, URL state, website
  validation and single-link cards.
- `git diff --check`, JSON parsing, source hashes and local documentation links
  were checked. Upstash integration is opt-in and remains skipped.

Development iterations corrected an accessible-name test matcher and an invalid
null-logo fixture (the public API requires a string). Failed attempts are not
counted as successful acceptance. Checks refer to the manifest, not a later merge.

## Initial browser evidence

[The T3 ledger](research/l2-local-browser.json) and
[the native Chromium fallback ledger](research/l2-native-browser.json) record measured DOM results
and their limitations. Tests used actual AltStack, real published-only API reads,
local stored-media fixtures and an owned T3 incognito tab. No research thread or
human-owned tab was changed.

- Long project names, unbroken category names/badges and a catalogue card were
  checked at **320/390/768/1280 CSS px**, in actual light and dark modes. Document
  widths were **310/380/758/1270**, respectively (stable scrollbar gutter), with
  no horizontal overflow. Computed typography remained Inter Variable.
- Keyboard Tab reached navigation, brand, submit, theme/account, hero, search,
  filter, sorting and cards. Enter activated hero/card links. Hero focus landed
  on `catalogue`, about 64 px below a 48 px header. Sorting retained query/category
  and reset page. Category Space/Escape returned focus. Mobile navigation closed
  after selecting Categories. Card focus was visibly outlined.
- More exposed four `aria-disabled=true` items with explanations and
  `pointer-events:none`. Arrow/Enter/Space produced no workflow; Escape returned
  focus. Desktop native disabled controls were inspected. User/admin public
  menus used explicitly mocked sessions: destinations stayed `/submission` and
  `/projects`; Bookmarks stayed disabled without a destination. This is not OAuth
  evidence. The sign-in dialog fit **320 × 480**, trapped Tab and returned focus
  on Escape; no provider button was invoked.
- All screenshot/website combinations, broken screenshot/logo, missing logo,
  unsafe website scheme and SPA source replacement were checked. Delayed media
  retained **262 × 147.375 px** before/after load. Failed media retained useful
  project links. No public request uses `placehold.co`.
- Three-second home/category searches retained editable text/focus and replaced
  stale cards with loading status. Combined category/query/sort/page survived
  reload/back/forward; Reset cleared filters. Boundary pagination was disabled.
- Controlled home/detail outages showed recovery rather than empty/404. Try
  again increased actual RPC counts **8 → 9** and **10 → 11** and recovered after
  the proxy became healthy. Automated tests also seed fresh external cache data
  before retry, verifying it cannot mask a required refetch.
- Missing/draft/rejected/removed slugs had identical generic copy, **404** and
  `X-Robots-Tag: noindex, follow`, without private fixture feedback. Packaged L1
  acceptance independently checked these contracts.
- The actual reduced-motion CSS media rule was temporarily forced in the owned
  tab and restored: button/menu transition and menu animation became **0.00001 s**.
  T3 does not expose this preference, so the permitted fallback also used real
  Chromium media emulation: `matchMedia` returned true for reduced motion and
  dark mode, and native menu animation/transition were **0.00001 s**.

T3 raster metadata remains 1280 × 800 independently of CSS viewport; narrow rasters
can repeat page panels. Rasters were visually inspected; geometry assertions use
DOM measurements. Local screenshots/logs remain under `.l2-acceptance.local/`
and T3 browser artifacts. Devtools emitted its existing multiple-Solid-instances
warning; controlled image 404s/outage errors were expected fixture behavior.
In a newly opened tab, native T3 desktop-menu clicks timed out twice with
`Preview automation click timed out after 15000ms.` A dedicated Chromium
headless profile then verified both role menus with actual CDP pointer/keyboard
events: Bookmarks remained inactive, Escape returned focus, destinations matched
roles, and four native desktop detail buttons stayed disabled. The same fallback
verified native reduced-motion/dark media emulation and a 390 × 844 viewport,
and captured/inspected full-resolution desktop/mobile dark rasters. No human
browser profile was used; the dedicated browser closed after acceptance.

## Navigation regression follow-up — 2026-10-16

The reported outgoing-homepage flash came from `ProjectListSection` reading
`router.state.isLoading`: every navigation replaced its already loaded cards
with a catalogue skeleton, including Submit and Categories. The manual switch
is removed. Route pending boundaries now own the 250 ms delay/200 ms minimum;
fast or cached transitions keep results, and a slow destination can show its
own pending view. Slow catalogue searches retain the persistent input and hide
older cards through the leaf pending boundary. React Suspense may retain hidden
DOM nodes; browser checks count visible cards, rather than all retained nodes.

The current manifest fingerprint is
`3991283cd0c84e83853249eebfbaa4a3ccec918b009de78569bd2ea063f068b8`.
Exact checks are recorded in [navigation validation](research/l2-navigation-validation.json).
The four outgoing-navigation regressions failed against the original switch,
then passed after removal. A fifth test checks cached catalogue navigation.
Existing delayed-search tests still verify focus and absence of visible old
results on home and category pages, using each route's actual pending label.

- `vp install`: exit 0; dependencies and lockfile unchanged.
- `vp test run apps/web/tests/public-category-routes.test.tsx`: **48 passed**,
  exit 0 on the final source.
- `vp check`: exit 0; no formatting, lint or type issues.
- `vp run --filter @altstack/db test:scoped -- vp test run`: **952 passed,
  1 skipped**, 59 files; wrapper exit 0. The opt-in Upstash integration remains
  skipped.
- `vp run -r build`: exit 0; existing dependency/chunk warnings remain.

The initial workspace-script, packaged SEO HTTP and broader L2 browser checks
above were run on the earlier fingerprint. They were not repeated for this
navigation-only fix; the full root suite and build were repeated. No metadata,
OG asset, API or auth guard changed in this follow-up.

The [navigation browser ledger](research/l2-navigation-browser.json) records
actual pointer/keyboard checks on the disposable runtime: 12 outgoing transitions
(detail/Categories/Submit at 320/390/768/1280 CSS px) under 300 ms network latency,
and two 390 px home/category search/cache checks with 1800 ms RPC delays.
Every outgoing transition observed real router loading without a homepage
skeleton; delayed destinations used their own pending labels. Guest Submit
retained `returnTo=/submit`, and measured document width never exceeded the
viewport. Slow searches kept the same focused input, hid old cards and
returned to cached unfiltered results without a skeleton flash.

T3 snapshots failed twice with the raw error
`Preview automation snapshot timed out after 15000ms.` The fallback used an
owned headless Chromium profile, real input events and DOM observations.
Automation-only corrections selected a card actually present on page one,
avoided serializing DOM objects, counted visible Suspense content, and waited
for finite view-transition animations before clicking the input again. Failed
harness attempts are excluded from the final successful run. No application
change was needed for those harness corrections. This follow-up covers guest
navigation; real provider authentication remains a separate gate.

## Disposable runtime and cleanup

With the README's development environment configured, run from this worktree:

```sh
rm -f .l2-acceptance.local/stop
vp run --filter @altstack/db test:scoped -- bun run apps/web/tests/l2-ui.acceptance.ts
```

The harness asserts `NODE_ENV=test` and a generated `altstack_test_<uuid>` schema
before inserting fixtures. The wrapper owns migrations/baseline data/cleanup.
Ports: app **3420**, controlled API proxy **3421**, fixture storage **3422**, real
API **3423**. The proxy delays/fails public RPC/media and provides mock sessions
only for public menus; real RPC authorization is independent. No account, email,
report or saved-project mutation occurs. Never use `test:isolated`, `db:push` or
application seed data for these checks.

Stop with `touch .l2-acceptance.local/stop`; let the wrapper exit and drop its
schema. The runtime, child processes and disposable schema were cleaned before
handoff.

## Separate release gates

Real OAuth/login/logout/expiry, dedicated Upstash integration, staging services
and storage, social crawlers/release domain, native mobile hardware and a full
assistive-technology audit remain open. Semantic browser checks are not a screen
reader certification. Merged-revision validation and rollout remain separate.
The future Verify/Bookmark/Report/Embed workflows stay backlog until their own
implementation can safely re-enable controls.
