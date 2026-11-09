# Changelog

Notable changes use the categories from
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
The v1.0.0 notes below cover changes since `v0.7.1`; earlier release entries
have not been reconstructed. See [release note guidance](CONTRIBUTING.md#documentation-and-releases).

## [Unreleased]

### Added

- Favicons beside ordinary internal and external Markdown links in public content
  and admin previews, with a text-only fallback when an icon cannot load.
- PowerShell syntax highlighting, including the `ps1` alias, in the shared editor
  language picker and public Markdown renderer.
- An independent word-wrap toggle on every public code block, including short
  blocks. Wrapping changes presentation without changing copied code.

### Changed

- Public Markdown links reveal their underline on hover with a 300 ms transition.
  Project and collection mentions retain their existing badges and icons.
- Public code blocks use custom One Light and One Dark Pro syntax palettes with
  matching bold-token rules, transparent bodies and headers, and equally sized
  icon-only copy and wrap controls with hover and keyboard-focus tooltips.
- Update oRPC to `2.0.0-beta.49` and tsrs to `0.23.0-ts7.1.0-beta`.

### Fixed

- Keep BlockNote's block-style select inside its editor portal so selecting part
  of a paragraph and opening the toolbar menu does not dismiss it. Heading
  changes remain available through the pointer and keyboard.
- Generate a name-based avatar when an account has no image.

### Upgrade notes

- Deploy matching API and web revisions. Changes since `v1.1.0` add no database
  migrations or environment variables; existing Markdown needs no migration.
- External-link favicons use Google S2 with only the destination hostname and no
  referrer. If that service is unavailable, links remain usable without icons.

## [1.1.0] - 2026-11-05

### Added

- Collection mentions in the shared Markdown editor through grouped `@`
  autocomplete and the slash menu. Mentions save as `/collections/{slug}`
  Markdown links and return as badges when the editor is reopened.
- Public collection badges with hover previews showing the collection name,
  description, type, and project count. Supported content includes project
  pages, blogs, collection articles, and About.
- Collection mention lookup follows public visibility rules. Draft or unavailable
  collections do not appear in suggestions or previews; existing links remain
  ordinary links when public metadata is unavailable.

### Changed

- Upgrade Vite+ and its Vite package alias from 1.4.0 to 1.5.0 and refresh
  the dependency lockfile.

### Upgrade notes

- Deploy the API and web from the same `v1.1.0` tag so collection mention lookup
  and rendering stay in sync. This release adds no database migrations or
  environment variables.
- Existing Markdown links to eligible public collections gain badges and hover
  previews automatically; no content migration is required.

## [1.0.0] - 2026-11-04

### Added

- Public blog directory and articles with cover images, writer attribution,
  publication/update dates, read time, heading permalinks, table of contents,
  social images, and sitemap discovery. Admins can create, edit, publish, and
  delete posts with rich Markdown authoring, cover uploads, and revision checks.
- Public About page at `/about` and admin editor at `/admin/about`. Title,
  description, and Markdown can be previewed and published immediately, with
  stale-edit protection and the shared public Markdown renderer.
- Sponsored campaign management with scheduling, artwork, tier eligibility,
  weighted selection, and labeled public banner, listing, sidebar, corner,
  and sponsor-grid placements.
- Account-free monthly advertising orders with private emailed management links,
  Ko-fi payment links, manual receipt confirmation, material review, renewal,
  and a durable notification outbox. Payments and refunds are not automated.
- Collection-based related-project suggestions on project detail pages.

### Changed

- Catalogue filters support selecting multiple categories and licenses while
  preserving search state in the URL.
- Project and collection directories use 45 display slots, sharing available
  space with listing ads and backfilling missing or blocked ads with organic items.
- Project cards reveal fuller descriptions on hover and keyboard focus, with
  touch-friendly links to project details.
- Updated oRPC to the 2.0 beta API and refreshed frontend/toolchain dependencies.
- Added React Doctor diagnostics to the development workflow and pull requests.
- Consolidated advertising and ranking reference material into the five main
  guides and synchronized the README, PRD, and roadmap with current behavior.

### Fixed

- Keep the initial server/client catalogue offset consistent during hydration,
  then restore tab-specific pagination boundaries without reusing another
  offset's query results.
- Preserve application-defined OpenAPI error statuses, including upload errors,
  after the oRPC upgrade.
- Prevent overlapping project-card links from blocking touch navigation.
- Release busy states after failed asynchronous actions so forms can be retried.
- Index category ancestry lookups and cancel/remove deleted-category detail
  variants together, retaining protection against late responses.
- Replace deprecated oRPC client types and Recharts legend positioning props.

### Upgrade notes

- Deploy matching API and web revisions. Apply the additive blog, advertising,
  order, and About migrations with `vp run db:migrate` before deploying them.
  The reserved-project-slug preflight must pass, including `/blogs` and `/about`.
- Configure ad email delivery using `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, a
  trusted `EMAIL_APP_URL`, and optionally `ADS_CONTACT_EMAIL`. Keep an API
  instance running for its advertising outbox loop.
- Review the Ko-fi destinations in `AD_PLANS` for the intended instance. Confirm
  receipts manually; opening checkout does not record a payment or extend dates.
- Follow the [deployment guide](docs/deployment.md) for proxy `QUERY` support,
  migration/configuration checks, scheduled workers, and instance acceptance.

[Unreleased]: https://github.com/isntboxs/altstack/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/isntboxs/altstack/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/isntboxs/altstack/compare/v0.7.1...v1.0.0
