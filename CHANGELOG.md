# Changelog

Notable changes are recorded here using the categories from
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This file starts with the documentation refresh; earlier release notes have not
been reconstructed. See [release note guidance](CONTRIBUTING.md#documentation-and-releases).

## Unreleased

### Added

- Public Collections directory and detail pages for admin-curated alternatives,
  repository lists, and ecosystems, separate from private bookmarks. Includes
  Markdown, catalogue-backed members, breadcrumbs, responsive numbered pagination
  with clean first-page URLs, catalogue/source logo artwork, writer avatars,
  bounded sticky navigation/sharing with active-project highlighting, mobile
  layouts, canonical metadata, and sitemap discovery.
- Admin Collections CRUD, publication, project selection and ordering, explicit
  account authorship, and revision checks. Hidden/deleted projects are filtered
  from public collection surfaces. Apply the new Collections database migration
  before deploying matching API/web changes; deployment acceptance remains pending.
- Contributor and security reporting guides.
- Development, architecture, and deployment guides.

### Changed

- Rebuilt the project README and simplified the PRD and roadmap.
- Consolidated documentation into five guides, with configuration/data import in
  development, feature behavior in the PRD, and navigation in the root README.
- Replaced deployment-specific configuration with synthetic examples and removed
  production evidence and generated QA artifacts from public documentation.

### Fixed

- Prevent project slugs from shadowing site routes across admin writes,
  publication, imports, and generated submissions, without changing category slugs.
  A read-only preflight blocks migration until legacy route collisions are resolved.
- Refresh collection management after failed deletions and omit public links for
  drafts. Keep collection detail pages available while supplemental discovery is
  pending or fails, rendering discovery cards independently when they become available.
