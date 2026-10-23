# Altstack identity

The approved production kit is maintained in the public
[altstack-brand repository](https://github.com/isntboxs/altstack-brand).
It contains the vector masters, exports, web icons, print files, usage guide
and mockups. Download the packaged kit from
[GitHub Releases](https://github.com/isntboxs/altstack-brand/releases/latest).

Altstack serves its own bundled assets below. The separate brand repository
is not a runtime or build dependency; changes there must be explicitly
copied into the application.

The implemented symbol is **Offset Blocks**: two solid, opposed polygonal
blocks with a stepped diagonal channel between them. It develops the weight,
offsets, and negative space of the earlier Offset concept into a different
silhouette. It is constructed as an abstract structure, independently from
the name or any letterform.

## Construction and selection

The symbol uses a 256 × 256 canvas and a 16-unit grid. The footprint is
224 × 224, centered with 16-unit margins. Two closed, seven-vertex paths use
only horizontal, vertical, and 45-degree edges. A 32-unit minimum separation
keeps the terminal gaps open at 16 px. Both bodies have equal area and are
related by a 180-degree rotation. There are no strokes, masks, gradients,
backgrounds, or raster elements in the symbol.

Three constructions were compared internally: orthogonal stepped blocks,
split polygonal masses, and opposing folded bands. The orthogonal direction
had a glyph-like reading; the folded bands were more familiar and thinner at
small sizes. Offset Blocks was selected for its heavier silhouette, broad
diagonal channel, and two distinctive registration notches. The initial
simple diagonal split was refined with those notches before implementation.

## Application

- Deployed symbol: [altstack-symbol.svg](../../apps/web/public/brand/altstack-symbol.svg).
- UI: [BrandMark](../../apps/web/src/components/brand-mark.tsx), used in the
  navbar and sidebar header. Its two paths match the master and inherit
  `currentColor`; the adjacent wordmark supplies the accessible link name.
- The existing Inter font, weights, 20 px symbol slot, navbar's 6 px gap, and
  sidebar's 8 px gap are preserved. The visible wordmark is lowercase.
- Browser: theme-aware transparent `favicon.svg`, plus a transparent black
  ICO fallback with 16/32/48 px images.
- App icons: white mark on black at 192/512 px; Apple touch icon at 180 px.
  The manifest and document head reference the new assets and Altstack name.
- Transactional email: [128 px transparent PNG](../../apps/web/public/brand/altstack-email-symbol.png)
  derived from the same bundled SVG, displayed at 32 px beside the lowercase
  text wordmark. Shared email layout and templates live in `packages/ui/src/emails`;
  [synthetic previews](../email-previews/README.md) record their separate QA.

Use the symbol in pure black on light surfaces and pure white on dark
surfaces. Keep the geometry and aspect ratio intact. Minimum screen size is
16 px; prefer 20 px or larger in navigation. Leave clear space of at least
32 design units (one notch width) around an isolated mark. Do not close the
channel, add an outline, bevel, shadow, or gradient, or animate the mark into
a different shape.

The UI wordmark uses the project's existing Inter Variable font, provided
under the SIL Open Font License in `@fontsource-variable/inter/LICENSE`.
The symbol is drawn directly as original vector paths and has no font
dependency. This design review is not a trademark clearance; obtain a
professional trademark and reverse-image search before a commercial launch.

## Regenerating assets

When changing geometry, update the master, the two paths in `BrandMark`, and
the paths in the theme-aware favicon together. Raster exports are derived
from the master with the logo-design skill's `render_png.py` and
`export_variants.py`. The ICO uses the master's original pixel-aligned
canvas rather than an additional scale transform. App exports use a black
background, white foreground, 0.56 icon scale, and zero optical offset.

## Verification

- The SVG master passed the structural audit with 100/100 (a heuristic score),
  with no live text, rasters, gradients, masks, strokes, or near-miss angles.
  The favicon scores 99/100 because of its intentional theme media rule.
- The symbol was rendered and inspected at 16/32/64 px, in black and white,
  and through two geometric refinement passes.
- Live homepage screenshots were inspected in light and dark themes at
  1280 px, plus the mobile layout at 375 px. The navbar mark measures 20 × 20,
  its gap is 6 px, and the wordmark remains Inter Variable 500 at 16 px.
  Neither viewport had horizontal overflow.
- The actual sidebar header was rendered under an isolated in-memory router
  with the application's styles, without creating an authenticated session.
  The final icon was measured at 20 × 20 with an 8 px gap and the existing
  Inter Variable 700 at 20 px wordmark. Its scoped `size-5!` override prevents
  the menu button's default descendant SVG rule from shrinking the brand mark.
- `vp check` passed format, lint, and type checks. All 185 web tests across
  18 suites passed. The final web production build passed, and the live
  homepage and auth-session endpoint both returned HTTP 200.

Collaborative-browser screenshots timed out, so live visual inspection used
a separate local headless Chromium profile. Screenshot capture was unreliable
for the isolated sidebar fixture; its size and alignment were also measured
directly in the rendered DOM. No browser or test dependency was added to the
project, and development credentials were read into process memory only.
