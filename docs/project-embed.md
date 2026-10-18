# Public project Embed badges

Embed is available without an account on published project details, from the
desktop button or compact **More → Embed**. Verify, Bookmark, Report and account
Bookmarks remain disabled with Coming soon. Admin moderation is unchanged.

Open `/<slug>?dialog=embed` to share the dialog. The canonical URL and all detail
metadata stay `/<slug>`. Unknown/reserved dialog values show no flow. Opening and
closing are ordinary history entries; Back/Forward follows those entries (Back
after Close reopens the dialog). Close removes only `dialog`, preserving unrelated
search state and the fragment. Same-detail dialog navigation keeps scroll, loaded
data and customization; visiting another project or reloading starts at defaults.
Focus returns to the originating desktop button or compact More trigger. Direct
links use the visible Embed/More control as their close-focus destination.

## Parameters and HTML

The actual image endpoint is `/<slug>/badge.svg?theme=dark&width=200&height=50`.

- `theme`: exactly `dark` or `light`; omitted defaults to `dark` independently of
  the application theme.
- `width`: decimal integer pixels, inclusive **160–1200**; omitted defaults to 200.
- `height`: decimal integer pixels, inclusive **40–400**; omitted defaults to 50.
- Empty, repeated owned parameters, signs, decimals, scientific notation,
  whitespace, NaN, Infinity and values outside the bounds return HTTP 400.
  Unrelated query parameters are ignored. The UI uses the same parser, preserves
  unfinished text and withholds preview/code/Copy until both dimensions are valid.
- SVG intrinsic dimensions exactly match the request and snippet attributes.
  Artwork retains its original proportions and is centered inside the requested
  canvas; unusual ratios add space. Preview scales to fit the dialog and reports
  the actual intrinsic size. Smallest dimensions keep the signature legible.

Generated snippets use absolute URLs from the **origin of configured
`VITE_APP_URL`**, following the SEO `publicUrl` helper. Request Host, forwarded
headers, current browser location and form input cannot set the origin. The
listing link carries `utm_source=altstack`, `utm_medium=badge`,
`utm_campaign=embed`, `utm_content=project-<slug>`. It opens with `target="_blank"`
and `rel="noopener noreferrer"`. The image has matching width/height,
project-specific escaped `alt="<name> badge"`, and `loading="lazy"`. HTML attributes
are escaped; preview uses an actual image, never injected project HTML. SVG titles
are XML-escaped. The designer-provided `apps/web/public/badge.svg` is bundled as
the artwork source, preserving its paths, rounded border and watermark. Dark uses the original
palette; light remaps its five colors. Exported inline styles become SVG
presentation attributes to work with the endpoint CSP. The full 200 × 50 design
scales proportionally, with transparent space for other aspect ratios. There are
no external fonts/images/scripts or foreignObject.

Copy awaits the Clipboard API. On rejection/unavailability, accessible feedback
explains manual copying and selects the read-only textarea. Edits clear stale
success, including a clipboard operation that resolves after editing.

## Visibility, caching and errors

GET and HEAD query current published project identity on **every request**,
matching the public detail's required repository join. No session/cookie is
needed. Unknown, draft, rejected, removed, deleted and incomplete published rows
without a repository return the same generic 404. Only the public name is read;
private feedback/submitter data is never selected. Database/service failure is
generic 503 with Retry-After 30, distinct from not found.

Responses use `Cache-Control: no-store` with no ETag or Last-Modified. Conditional
headers do not bypass the database read or return 304. This intentionally trades
extra small reads/bytes for immediate unpublish on the next request; there is no
in-process render cache. A badge already displayed in an open page cannot be
recalled until that page requests it again. Third-party snapshots/proxies that
ignore these headers are outside this contract.

SVG responses are inline `image/svg+xml; charset=utf-8`, `nosniff`,
`Cross-Origin-Resource-Policy: cross-origin`, and sandboxed with no external
resources. Normal cross-origin image embedding requires no CORS fetch, iframe or
authentication. `X-Robots-Tag: noindex` applies to all responses; generators and
dialog query permutations are absent from sitemaps. L1 OG/privacy/indexing rules
continue to apply.

## Local verification and deployment

No migration or new dependency is required. Production Node/Nitro serves the
literal `.svg` route independently of the `/$slug` UI. Build-time `VITE_APP_URL`
must be the public deployment URL, as for existing canonical/OG URLs. Deploy the
matching web/server revision with the existing database configuration. Ensure the
reverse proxy/CDN forwards this route, honors no-store and cross-origin resource
policy, and does not force SVG attachment downloads. Verify both themes from a
different origin, plus unpublish/conditional GET/HEAD, after deployment.

Safe commands from repository root:

```sh
vp install
vp check
vp run --filter @altstack/db test:scoped -- vp test run
vp run -r build
vp run --filter @altstack/db test:scoped -- bun apps/web/tests/seo-http.acceptance.ts
vp run --filter @altstack/db test:scoped -- bun apps/web/tests/l2-ui.acceptance.ts
```

The HTTP suite builds with its own canonical origin, exercises cold isolated
Node output and real scoped queries, including SVG theme/dimensions, errors,
unpublish/delete, conditional headers and metadata/sitemap regressions. It saves
native/custom PNG evidence in its reported cache directory. The L2 browser runtime
uses ports 3420–3423, synthetic fixtures and a disposable schema; its `/embed`
page on port 3422 accepts copied HTML for separate-origin browser QA. API control
tracks requests and can toggle only its owned `l2-atlas` fixture's publication.
Write `.l2-acceptance.local/stop` to finish and clean that schema. Never use
test:isolated, db:push or application data for these checks.

Automated unit/UI tests cover validation/escaping, preview and clipboard outcomes,
URL history and deferred actions. Mocked service failures do not establish real
OAuth, Redis, CDN or production acceptance. Record the tested branch fingerprint
and local results separately in the roadmap; a future merge/deploy needs its own
verification.

## Verification record — 2026-10-17

Tested branch: `feat/project-embed`, base HEAD
`46a1e0f76b35593dd3b55979ad1cd2a95b8bb15d`, with uncommitted implementation/tests.
Source/test fingerprint:
`8e29732b01051a149865f3c8515ff611fd0844087d6286c02f888b00be29efb6`.
This is SHA-256 of sorted records `path + NUL + sha256(file bytes) + LF` for
13 changed/new files under `apps/` and `packages/`; documentation and local
runtime/evidence files are excluded to avoid a self-referential hash.

- `vp install`: passed with Bun 1.4.3 / Vite+ 1.3.0; manifests/lockfile unchanged.
- `vp check`: passed, zero warnings, lint errors or type errors across 334 files.
- Disposable-schema root `vp test run`: **992 passed, 1 skipped**, 60 passed test
  files and one skipped file; final run 270.87 s. The skip is opt-in real Upstash
  integration. Focused badge/UI coverage: **88 passed**, including 55 real-router
  UI tests; final focus fixture supplies jsdom's missing standard media API.
- `vp run -r build`: **8/8 tasks passed** during the scoped HTTP suite. Existing
  dependency directive and large client chunk warnings remain.
- Scoped `seo-http.acceptance.ts`: **14 acceptance groups passed**, including cold
  standalone Node output with only production dependencies, SVG GET/HEAD and
  defaults/bounds/errors, published/hidden/orphan/deleted identity, unpublish with
  conditional headers, actual DB failure 503, clean dialog metadata and existing
  OG/sitemap/privacy regressions. Both themes were visually inspected at native
  200 × 50, 320 × 80, and extreme aspect ratios.
- T3 collaborative browser (agent-owned tab): desktop 1440 × 900, mobile
  320 × 568 and 390 × 844; both app/badge themes, keyboard and focus trap,
  desktop/compact Embed, direct/reload/Back/Forward, X/Escape/outside, editable
  invalid dimensions, large preview, success and rejected clipboard selection,
  preview failure after fixture unpublish and recovery. Scroll stayed 180 before
  and after dialog history changes; heading DOM identity stayed intact; zero
  project RPC requests and zero new skeletons were observed. Resizing while open
  restored focus to the visible More control. Actual clipboard HTML loaded light
  320 × 80 and dark 200 × 50 images on `localhost:3422` from `localhost:3420`.

Local HTTP evidence: `/home/mrboxs/.cache/altstack-l1-http-CghRG5/results.json`
and adjacent native/custom PNGs/build logs. Browser observations and fingerprint
manifest: `.l2-acceptance.local/embed-results.json` and `embed-fingerprint.json`.
Screenshots are retained in T3 browser artifacts. Owned runtime processes ended
and disposable schemas were cleaned by their wrappers; shared application data
was not used. No push, PR or deployment was performed. This record does not verify
any future merge, production domain/CDN, real OAuth or opt-in Upstash service.

## Designer artwork update — 2026-10-17

The generator now bundles `apps/web/public/badge.svg` directly. Tested on HEAD
`168c97dbff7d2109a16568807e636314a82a4160` plus this local update. The same
source/test fingerprint algorithm above, over the four changed source/test/SVG
files, yields `479f7444a13071a342af6b6e946f54e194094abb4e3261a26a9f1809d31c2f80`.

- `vp install` and `vp check`: passed; no dependency changes.
- Focused badge/Embed UI tests: **33 passed**.
- Disposable-schema production HTTP acceptance: **14 groups passed**, including
  the **8/8** workspace build; evidence in
  `/home/mrboxs/.cache/altstack-l1-http-oMasqX`.
- Native dark 200 × 50 raster output is pixel-identical to the supplied SVG.
  Dark/light and custom sizes were visually checked in disposable Chromium,
  serving captured production SVGs with the endpoint CSP. T3 snapshot timed out
  twice and its automation client disconnected during reconnect, requiring this
  browser fallback. Screenshot: `/tmp/altstack-badge-design-qa/browser.png`.

The full root suite and dialog interaction matrix recorded above were not rerun
for this artwork-only update. No push or deployment was performed.
