# L1 — SEO, structured data and social cards

Implemented on `feat/l1-seo-og`, based on merged R5b commit `fe73d53`.
This document records local implementation and verification, not deployment.

## Identity and image sources

The approved [AltStack brandkit](https://github.com/isntboxs/altstack-brand)
was inspected at `74e2832867ee09e8d375b1e51b9c1ab89f300a66`: README,
palette, construction, masters, outlined Inter source, digital signatures and
wordmarks, usage guide, presentation/slides and verification sheets.
Only its approved Offset Blocks identity is used. The bundled signature SVG is
copied unchanged. There is no runtime/build dependency on the brand repository.

The 1200 × 630 family uses black/white, the complete outlined signature,
Inter 400/500, a 64 px text margin and the unmodified symbol as a cropped
motif on the right. Default copy follows the supplied brief. Project cards put
the real project logo/name first, description (tagline fallback) below, stored
GitHub stars/forks at the upper right, and the complete AltStack signature in
the footer. Repository name and UTC snapshot date identify the source/freshness
of those counts. Missing/invalid statistics are omitted; zero is retained.
Category cards use the canonical category name/description. No rankings, ratings
or UI mockups are generated. The home/category designs are unchanged by the
project-logo extension.

- Static deployment asset: `apps/web/public/og/default.png`.
- Shared layout, fitting and renderer: `apps/web/src/features/seo/og/card.tsx`.
- Local font, metrics, glyph coverage, license and signature: adjacent `assets/`.
- Live endpoints: `/og/project/{project UUID}` and `/og/category/{category UUID}`.
- Regenerate: `vp run --filter web generate:og`. No network, DB, timestamps or
  randomness is involved. Commit the regenerated PNG alongside layout changes.
  Bump `ogVersion` in `meta.ts` when changing the dynamic card layout.

Static TTF instances are Inter's official roman variable font at weights 400
and 500, optical size 32, instantiated using fontTools. SIL OFL 1.1 is bundled.
TTF is used because Satori does not accept the app's WOFF2 variable font.
The outlined brand signature retains the kit's own Inter construction.
Line fitting uses bundled glyph advances and explicit word wrapping/truncation.
Latin, Greek and Cyrillic are retained; emoji/unsupported glyphs and format
controls are removed. A title with no supported letters/numbers uses its public
slug. HTML metadata retains the original Unicode title.

`@vercel/og` is pinned to **0.8.6**. The evaluated 1.0.3 package failed the
Node ESM prototype (`Dynamic require of "fs" is not supported`) and the Bun
prototype (missing `hb.wasm`). The pinned version uses its packaged Yoga/Resvg
WASM. Vite SSR and Nitro keep this dependency external, matching the existing
Docker prod `node_modules` layout. Fonts/signature are inlined into a server
chunk; neither requires the original source path. Route handlers import the
renderer lazily and are stripped from client builds.

Project logos are optional. `logo.server.ts` accepts only promoted final logo
keys under the configured `VITE_S3_PUBLIC_URL` (or their equivalent absolute
URLs), and existing numeric-account avatars on `avatars.githubusercontent.com`.
Avatar URLs are reconstructed with a fixed 192 px size. Arbitrary hosts, paths,
query inputs, redirects, SVG and embedded URLs are rejected. Fetches have a 2 s
deadline and 3 MiB byte limit, with MIME/magic-byte agreement. **Sharp 0.35.5**
normalizes only PNG/JPEG/WebP/GIF buffers into metadata-free PNG, first frame,
at most 192 × 192, with a 4,194,304 input-pixel limit and 1 s decoder timeout.
Failures use a typographic project initial; they do not prevent card rendering.
No GitHub API request is made by the image endpoint. Sharp stays external and
server-only; its native optional packages must be present in the production
dependency install, as in the existing Docker layout.

## Metadata and indexing

`VITE_APP_URL` supplies the canonical public origin at **build time**, as other
VITE variables do. Paths/query/fragment on that configuration are ignored by the
metadata helper; request Host/forwarded Host never determines public URLs.
Production builds must supply the real HTTPS public domain and rebuild after a
domain change. Loopback domains in acceptance checks are intentional local test
configuration. `VITE_SERVER_URL` still identifies the separate auth/API service.

- `/`, `/categories`, published `/{slug}`, and populated canonical category
  pages have route-specific titles, descriptions, canonical, complete OG image
  descriptors and Twitter large-image cards in SSR HTML and client navigation.
- `q`, homepage `category`, and nondefault `sort` permutations are `noindex,
  follow`, canonicalized to that route's clean catalogue/category URL.
- Pure `page > 1` is self-canonical (`?page=N`); out-of-range pages are noindex.
  Tracking/unknown parameters do not enter canonicals. Pagination links remain
  crawlable; sitemap does not enumerate query permutations.
- Historical category paths preserve the existing one-hop 308 and raw query;
  current paths supply metadata and sitemap URLs. Empty known categories are
  readable and have a dynamic card, but are noindex and omitted from sitemap.
- Auth, submit, private submission, project management and admin routes carry
  noindex metadata/`X-Robots-Tag`, including unauthenticated redirects. Error/404
  pages use generic noindex metadata with no guessed canonical or private data.
- SSR HTML is private/no-store because navigation includes session state.
  Existing API authorization and R5b return guards are unchanged.

Project image URLs contain a layout/content revision and the GitHub snapshot
revision, so a stats refresh changes the SSR-selected URL even when the listing
has not been edited. Category revisions derive from public copy. Every image
request checks live public visibility before the 32-entry single-flight render
cache. Cache keys include public copy, logo key, repository counts and snapshot;
entries expire after 60 s, bounding same-key logo replacements/fallbacks. At most
two new renders (including asset download/decoding) run concurrently. Responses
are **no-store**, including failures,
so AltStack does not serve a stale CDN image after unpublish/delete. Old revision
URLs also return current public copy or generic 404. Social platforms may retain
their own copies; their purge/recrawl behavior is outside the application's
control. Render/DB failures return generic retryable 503 responses.

## Crawling and structured content

`/sitemap.xml` is a live sitemap index. `/sitemaps/pages.xml` includes home,
categories index, the existing public activity page and populated public taxonomy; project shards at
`/sitemaps/projects/{positive page}` contain at most 1000 published projects with
the repository row required by public detail/list queries. They use stable ID
ordering, encoded paths, XML escaping and actual listing modification dates.
No GitHub requests, build-time catalogue crawl, credentials or private rows are
involved. Sitemap responses are XML/no-store, with controlled retryable failures.

`/robots.txt` is a server route (the stale public file was removed). It advertises
the configured-origin sitemap, permits `/og/` and disallows private/API paths.
Robots is a crawl hint; it is not authorization. There is no extra public feed or
LLM API: the canonical pages already expose the factual catalogue content.

Public pages emit safely escaped JSON-LD: WebSite/Organization, CollectionPage,
and SoftwareSourceCode with the real repository source and optional website.
No submitter, rejection note, fabricated author, review, rating, price or license
claim is added. Public documentation now uses `react-markdown`/GFM for both SSR
and hydration, replacing the earlier BlockNote viewer/SSR fallback combination.
Raw HTML is omitted and unsafe link schemes are filtered. Server-prepared Shiki
tokens and published project mentions enhance the same readable document;
preparation failures retain plain Markdown/code. Preparation accepts only a slug
and reads stored public content. BlockNote remains the admin editor/import preview.
See [the current content/media implementation status](roadmap.md#public-content-and-media-polish--2026-10-18).

## Verification and remaining release checks

Run from repository root:

```sh
vp install
vp check
vp run --filter @altstack/db test:scoped -- vp test run
vp run --filter web test:seo-http
```

The HTTP acceptance command owns a disposable schema, builds workspaces, creates
synthetic public/private fixtures and installs a prod-only hoisted dependency
tree. It runs Node/Nitro from a relocated `.output` with no source checkout.
Outbound fetch is limited to the local existing auth API, synthetic local raster
asset server and inline data assets. Production logo policy is exercised using
the configured local storage base; no genuine external image is downloaded.
It checks actual SSR tags/content/JSON-LD, canonical/indexing/308 behavior, public
sitemap changes, PNG bytes/MIME/dimensions, revisions, long/missing/Unicode copy,
old URLs after changes/unpublish/delete, cold restart and client bundle separation.
Logo cases include raster formats, unsafe URL rejection, corrupt/missing/oversize
inputs, successful production decoding, cache reuse, and changed logo/statistics.
Evidence is written to a private local cache directory; temporary runtimes are
removed on completion. `--preview` on the underlying acceptance script keeps
synthetic fixtures alive for collaborative browser QA. Never use reset/seed or
`test:isolated` against the application schema for this work.

Local results and visual QA are recorded below. Real public
domain DNS/TLS, social-provider fetch/debuggers/cache purges, Search Console and
schema validator checks remain staging/production release checks. No deployment,
push, PR publication or promise of AI citations/ranking is part of L1.

Primary references: [TanStack SEO](https://tanstack.com/start/latest/docs/framework/react/guide/seo),
[GEO](https://tanstack.com/start/latest/docs/framework/react/guide/geo),
[Vercel OG](https://vercel.com/docs/og-image-generation),
[Satori](https://github.com/vercel/satori),
[Sharp constructor](https://sharp.pixelplumbing.com/api-constructor/),
[Sharp installation](https://sharp.pixelplumbing.com/install/),
[Inter](https://github.com/rsms/inter),
[SoftwareSourceCode](https://schema.org/SoftwareSourceCode),
[CollectionPage](https://schema.org/CollectionPage).

### Historical L1 verification on 2026-10-14

Tested revision: baseline **`fe73d53` plus the L1 working-tree changes** on
`feat/l1-seo-og`, not a new merged commit. SHA-256 of changed implementation,
tests, assets and lockfile (sorted path + NUL + bytes + NUL; excluding `docs/`
and README files):
`dbd9566a334468f73ac873ca513493d033376980b6f7926c574f2ca27cd739e6`.

- `vp install`: passed. `vp env doctor`: all checks passed.
- `vp check --fix`: format, lint and types passed with zero warnings/errors.
- `vp run --filter @altstack/db test:scoped -- vp test run`: **920 passed,
  1 skipped**, 57 files. The skip is the existing opt-in development Upstash
  integration (`UPSTASH_RATELIMIT_INTEGRATION`); no real Redis mutation was run.
- `vp run --filter @altstack/db test:scoped -- bun run apps/web/tests/seo-http.acceptance.ts`:
  all **10 HTTP acceptance groups** passed, including its `vp run -r build`
  (8 tasks), prod-only dependency install, relocated Node 24.21.0 output,
  cold restart, live visibility/cache changes and simulated scoped DB failure.
  Build emitted existing large-chunk/`use client` directive notices. Docker
  itself was not invoked; the web runtime file/dependency layout was reproduced.
- T3 collaborative browser: home → project → category updated a single title,
  canonical, OG image and JSON-LD graph during client navigation. A retained
  window marker confirmed the document was not reloaded; no horizontal overflow
  or hydration error was observed. The baseline fixture's missing logo produced
  an expected test-only 404, unrelated to the OG assets.
- The final default and captured dynamic PNGs were viewed at **1200 × 630** and
  **320 × 168**, including long unbroken names, supported Unicode and missing
  fields. Signature proportions/channel, margin, contrast, word wrapping and
  clipping were inspected. Static output also matches a fresh render in tests.

Original fixture captures were inspected at both sizes. The maintained project
preview and contact sheet are updated by the follow-up verification below.
Test processes/runtimes were stopped and disposable schemas removed.

An earlier run hit the `/tmp` quota while copying repeated runtime dependency
trees; its affected tests were rerun successfully after cleanup. The final
acceptance harness uses the local cache and removes its runtime copy in `finally`.
The earlier 918-test run and historical R5b counts are not substituted for the
920-test result above. Real production-domain/social-crawler acceptance remains
unverified.

### Verified locally on 2026-10-15 — project logos and GitHub statistics

Tested revision: **`8d51af6` plus the project-card working-tree changes** on
`feat/l1-seo-og`. Implementation/test/lockfile fingerprint using the same
sorted-path algorithm above:
`0559ca938addb1edc1c0d66a89d07c8eb9ef1868106a59bae785dd8d06d60ffa`.
These results verify the follow-up locally, not a merged or deployed revision.

- `vp install`: passed; added pinned production dependency `sharp@0.35.5`.
- `vp check --fix`: formatting, lint and types passed with zero warnings/errors.
- Disposable-schema `vp test run`: **925 passed, 1 skipped**, 58 files.
  The skip remains the existing opt-in Upstash integration.
- Disposable-schema `seo-http.acceptance.ts --preview`: **11 HTTP acceptance
  groups passed**, including the full 8-task production build, prod-only install
  and relocated Node/Nitro runtime. Native Sharp decoding works with packaged
  production dependencies. The test fetches only its synthetic local assets;
  corrupt raster/SVG spoofing falls back, nonpublic projects fetch no logo,
  repeated requests reuse the render, and changed logos/stats refresh the PNG.
  A GitHub snapshot refresh alone also changes the SSR image revision. Original
  metadata/indexing/sitemap/visibility/error/cold-start checks still pass.
  Existing build notices remain; Docker itself was not invoked.
- Viewed the actual endpoint rasters at **1200 × 630** and **320 × 168**,
  including long names, absent copy, Unicode, non-square WebP and corrupt/missing
  logo fallbacks. Inspected title/stat separation, contrast, logo aspect ratio,
  approved symbol geometry/cropping and the complete footer signature. The
  unchanged static default still matches a fresh deterministic render in tests.
- T3 navigation opened the production page, but snapshots twice returned
  `Preview automation snapshot timed out after 15000ms.` and the reopen stalled.
  Browser QA therefore used Chromium headless/CDP with a disposable separate
  profile. Home → project navigation retained a window marker, a single title,
  canonical, OG image and JSON-LD graph; the real project logo loaded, there was
  no horizontal overflow or runtime exception, and the metadata-selected PNG
  loaded as 1200 × 630. Page and image screenshots were inspected.

Maintained endpoint captures: [project](brand/og/project-fixture.png),
[category](brand/og/category-fixture.png),
[320 px contact sheet](brand/og/preview-qa.png). Names, logos and statistics in
these examples are synthetic test fixtures, not actual listings or claims.
Real production-domain and social-provider crawl/cache acceptance remains
unverified; no push, PR or deployment was performed.
