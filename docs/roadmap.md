# Roadmap

This is a direction of work, not a release-date commitment. The
[PRD](prd.md) defines requirements and current feature behavior.
Source implementation, automated verification, and an
operator's deployment acceptance are separate states; this roadmap does not
publish a live-instance inventory.

## Implemented in the current source

- Catalogue browse/detail/search, category hierarchy, topic tags, license
  discovery, archived metadata, sorting, and observed GitHub star history.
  Recommended is the homepage default, using stored repository metadata,
  age/activity factors, verification eligibility, and an archived penalty.
- GitHub/Magic Link sign-in, private intake, moderation/history, rejection
  correction, and review-decision email outbox/worker.
- Markdown/media content, README import, metadata refresh, file imports,
  canonical metadata/sitemaps, social images, and SVG embed badges.
- Private bookmarks, report intake/admin triage, and detail-page featured curation.
  Featured configuration accepts up to 24 eligible projects independently of
  homepage ranking and advertising inventory.
- Public curated Collections: alternatives, repository lists, and ecosystems,
  with manual admin CRUD, draft/publication controls, revision checks, and ordered
  catalogue membership without ranking. Discovery includes clean first-page URLs,
  responsive numbered pagination, breadcrumbs, catalogue/source artwork, writer
  avatars, and bounded sticky project navigation and sharing. Canonical metadata
  and sitemaps share the live publication policy.
- Editorial blogs with Markdown, cover media, draft/publication controls,
  authorship, revision checks, and public metadata/social images. About is a
  single public Markdown document editable at `/admin/about`, with immediate
  publication, conflict protection, navigation links, and sitemap discovery.
- Advertising campaigns and account-free monthly orders: private emailed links,
  Ko-fi payment links with manual receipt confirmation, artwork review, rolling
  paid periods, and explicit renewal. The API process delivers advertising
  notifications from a durable outbox. Placement eligibility, weighted selection,
  session timing, cosmetic hiding/backfill, and 45-slot project/collection
  pagination are implemented; automated payment reconciliation and ad analytics
  are not.
- Representative verification/editing, member leave/administration, protected user
  actions, admin work queues, recorded activity, and operational observations.
- Local development/test PostgreSQL separation, disposable schemas, and targeted
  unit/browser/HTTP verification tools.

These items are not promises that every integration or deployed revision has
passed acceptance. Use the [deployment guide](deployment.md) for an instance's
migration, worker, provider, and recovery verification.

## v1 rollout

The current source includes the product features listed above, including About,
blogs, Recommended ranking, and advertising. The remaining v1 work is release
and instance acceptance, rather than treating these features as future scope.
This document does not mark v1 as released or certify a production rollout.

Rollout requires a passing reserved-project-slug check, all migrations through
`about-page`, and matching API/web revisions. Check public eligibility,
representative access, editorial saves/conflicts, advertising order privacy,
manual receipt/review/renewal, artwork, email delivery, and responsive pagination
on the intended instance. Verify the Ko-fi package destinations belong to that
instance's operator. Local/mock-provider results do not establish those live
outcomes, and applying a migration does not start external schedules.

## Near-term priorities

| Priority | Work                        | Completion criteria                                                                                                                                                               |
| -------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | Public repository readiness | Select a license; establish a private vulnerability reporting channel; keep onboarding and release notes accurate                                                                 |
| 2        | v1 release acceptance       | Confirm matching API/web revisions, migrations, auth/session flows, representative/admin access, editorial content, and manual ad payment/review/renewal on the intended instance |
| 3        | Operational reliability     | Verify scheduled runs, backup freshness/failure alerts, isolated restores, asset cleanup, and credential separation for the operated instance                                     |
| 4        | Provider-dependent coverage | Verify OAuth/Magic Link expiry/replay, proxy headers, email delivery/recovery, storage, Ko-fi receipts, and social crawlers without treating unrelated checks as passing          |

Operational evidence and assigned operator follow-ups belong in private tracking.
Recheck a completed acceptance scenario when a related change or failure justifies
it. Do not repeatedly queue historical verification as new product development.

Potential reliability implementation slices include email delivery/bounce webhook
handling, an explicit private-data retention policy, persistent job-run telemetry,
and first-admin provisioning tooling. Each needs its own scope and tests; the
current dashboard/outbox does not provide those capabilities.

## Conditional product work

The sequence below follows the existing user journey. Select a slice after user
feedback or observed usage justifies it; none has a scheduled release.

| Order | Candidate                    | Trigger and acceptance                                                                                                         |
| ----- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1     | Private named bookmark lists | Returning users need organized bookmarks; preserve account privacy and hidden/deleted-project behavior                         |
| 2     | Focused project comparison   | Validate useful comparison fields with real evaluations; let a user assess a shortlist with honest missing data                |
| 3     | Report workflow improvements | Observed report volume identifies a bottleneck; solve one need such as reopen/follow-up with authorized private changes        |
| 4     | Homepage editorial sections  | Catalogue coverage and feedback justify another discovery path; demonstrate value beyond current sorting/featured detail links |

Private bookmark sharing, assignment/comments/report email, and a dedicated
personalized/trending feed are separate decisions rather than implied additions.

## Deferred until justified

Guest project submission, profiles/follows/reviews/ratings, media galleries/video,
newsletter/RSS, historical/product or ad analytics, public ranking-score
breakdowns, SDKs, and extensions remain unscheduled. Automated ad billing and
recurring subscriptions would require a separately scoped provider integration;
the existing Ko-fi links and manual confirmations do not implement them.
An external search service requires measured PostgreSQL limitations.
Confirmed regressions and access/data-integrity issues take priority over feature
expansion.

## Delivery approach

Deliver a small user outcome with schema/migration, contract/authorization, UI,
focused tests, and documentation together. Split work too large to review as one
coherent change. Keep migration history intact and use existing infrastructure
unless evidence supports adding another dependency.

Before release, record the affected checks and remaining integration gaps, prepare
the operator's migration/configuration instructions, and move notable entries
from `Unreleased` into the [changelog](../CHANGELOG.md). Deployment acceptance
remains specific to the operator's chosen revision and environment.
