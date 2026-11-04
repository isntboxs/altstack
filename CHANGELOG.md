# Changelog

Notable changes use the categories from
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
The pending v1 notes below cover changes since `v0.7.1`; earlier release entries
have not been reconstructed. See [release note guidance](CONTRIBUTING.md#documentation-and-releases).

## [Unreleased]

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

[Unreleased]: https://github.com/isntboxs/altstack/compare/v0.7.1...HEAD
