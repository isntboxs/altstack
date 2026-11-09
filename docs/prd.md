# Product requirements

AltStack helps developers answer: **Which open-source tool should I try for this
job?** It is a curated catalogue with useful technical context, accountable
editing, and a small set of private workflows.

This document defines product scope, requirements, and current feature behavior.
The [roadmap](roadmap.md) tracks future priorities and the
[changelog](../CHANGELOG.md) records notable release changes. Source behavior does
not certify a particular deployment; use [deployment acceptance](deployment.md#migration-and-rollout)
for instance-specific checks. Exact payloads live in [API contracts](../packages/api/src/contracts)
and [shared schemas](../packages/shared/src/schemas).

- [Users and problems](#users-and-problems)
- [Access and authorization](#access-and-authorization)
- [Functional requirements](#functional-requirements)
- [Quality and operational requirements](#quality-and-operational-requirements)
- [Scope boundaries](#scope-boundaries) and [success signals](#success-signals)

## Users and problems

| User                       | Need                                                                         |
| -------------------------- | ---------------------------------------------------------------------------- |
| Developer evaluating tools | Find a relevant project and assess its purpose, license, activity, and setup |
| Returning visitor          | Save a private shortlist and revisit projects                                |
| Project contributor        | Submit a project and understand a moderation decision                        |
| Project representative     | Establish authority and keep a listing accurate                              |
| Catalogue administrator    | Review intake, maintain taxonomy, handle reports, and protect access         |
| Editorial administrator    | Publish blog posts and maintain the public About page                        |
| Advertiser                 | Buy a monthly placement, submit artwork, and manage its review and renewal   |

## Product principles

- Prefer a smaller accurate catalogue to inflated counts or fabricated metadata.
- Keep discovery usable without an account; require sign-in for durable private
  state and accountable project workflows.
- Distinguish repository observations, editorial curation, and representative
  verification. A badge does not assert legal ownership or software quality.
- Keep public content separate from contacts, feedback, claim evidence, and auth.
- Make permissions and state changes explicit, recoverable, and auditable where
  supported. Never infer project rights from submission or login alone.

## Core journey

Browse/search → narrow by category, topic, or license → open project details →
inspect documentation and repository observations → visit upstream or bookmark.
Public collections offer another discovery path through alternatives, ecosystems,
and repository-based curation, with links back to the same project catalogue.
Visitors may report incorrect information. Signed-in contributors submit intake,
receive a decision, and correct rejected intake. Approved representatives keep
published project content current within their scoped permissions.

## Access and authorization

| Actor                                | Access                                                                                                                                          |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Guest                                | Browse published projects and collections, use share/embed, submit a private report with contact email                                          |
| Signed-in account                    | Guest actions, private bookmarks, submit/track/correct its own intake, request project access                                                   |
| Approved project Owner or Maintainer | Edit the approved published project, review additional access requests, view members, leave membership                                          |
| Admin                                | Catalogue moderation, taxonomy/featured/collection/report management, eligible first-claim review, protected membership and user administration |

Guests can also read published blogs and `/about`, and order advertising without
an AltStack account. A private emailed link authorizes access to that advertising
order only; it does not create a session or grant project membership. Admins also
manage blogs, About content, advertising campaigns, payment confirmations, and
artwork review.

Owner and Maintainer have equal project permissions. Roles are scoped to a
membership, not inferred from sign-in, a global label, or submission history.
Admins cannot approve their own claims or bypass another submitter's correction
authorization.

## Functional requirements

### Catalogue and discovery

The catalogue has search, URL-persisted filters/pagination, categories, GitHub
topic tags, and license pages. Public counts and results include only published
projects with the repository data required by the catalogue.

Project slugs cannot use reserved site-route names such as `about`, `collections`,
`tags`, or `bookmarks`. Admin writes, publication, and file imports enforce the shared
reservation policy. Submission-generated slugs append `-project` when their base
would be reserved. Category slugs retain their existing validation.

- Categories have at most three levels. Projects receive 1–3 distinct direct
  **leaf** categories; ancestors aggregate distinct published projects. A category
  with assignments cannot gain children. Only empty leaves can be deleted.
  Renames/moves retain historical paths and redirect to the current path.
- GitHub topics synchronize tag assignments on successful metadata writes.
  Admins may edit display copy and hide tags without losing curation during sync.
  Tag slugs are stable; only unassigned tags can be deleted. Hidden/empty tags
  are excluded from public discovery.
- Recognized SPDX metadata links to license discovery and a license document.
  Missing/custom/unrecognized metadata stays `unknown`. The unknown filter is
  noindex; it is not a license assertion. Archived is based on GitHub's flag;
  it does not automatically unpublish a listing.
- Home defaults to [Recommended ranking](architecture.md#recommended-ranking), combining normalized stars
  and forks, repository age, recent activity, and a 5% verification bonus;
  archived repositories receive a penalty. Ties use deterministic ID ordering.
  Category/tag/license catalogues default to Most stars. Explicit
  Latest sorts by listing creation time. Most popular currently means total
  GitHub stars, like Most stars; other options include name, forks, last commit,
  repository age, Oldest, and Trending.
- Trending compares the earliest/latest observed totals within a seven-day
  interval using Asia/Jakarta dates. It requires two different observation dates;
  missing history ranks last, and negative changes remain valid.

Project and collection directories have 45 display slots per full page. Eligible
listing ads occupy up to three slots, leaving 42 organic items; missing or hidden
ads are backfilled with catalogue items. Numbered page URLs stay shareable.
Session offsets preserve sequential traversal as ad availability changes; a new
tab uses canonical 45-item boundaries. See [listing pagination](architecture.md#listing-capacity-and-pagination)
for the ledger and its limits during concurrent catalogue changes.

### GitHub metadata and content

Public page reads use stored snapshots rather than live GitHub API calls. Refresh
is available to admins and through the daily worker. Successful complete refresh
stores stars, forks, repository identity/creation, the default branch's last-commit
timestamp (`lastCommitAt`), latest release, topics, license, archived state, and an
observation timestamp.
Provider failures retain the previous snapshot.

Star history records actual totals by Asia/Jakarta date, one point per date.
The detail chart uses a 30-day interval with up to 31 points including a baseline;
there is no synthetic historical backfill or interpolation. A single point shows
collection in progress; stale snapshots are labeled. Retention is 90 date buckets,
pruned by the scheduled job. Same-ID repository renames preserve history;
identity changes clear unrelated history.

Admins can import a GitHub README into the content editor. Relative links/images
are resolved against the source repository/revision; unsupported markup and
unsafe URLs are removed. A missing or oversized README produces a recoverable
error. Public content supports Markdown/GFM, highlighted code, and catalogue
project mentions; imported content still needs editorial review.

### Sign-in and account access

GitHub OAuth and email Magic Link are the public sign-in methods. Password-based
sign-in/signup are disabled. Magic Links expire after ten minutes and are
single-use; requesting one does not create a session. Matching verified email
is required for GitHub account linking. A separate claim contact address does not
change or merge login accounts.

Auth uses persistent PostgreSQL rate limits; submission/report quotas use Redis.
Magic Link delivery requires configured email credentials. Errors avoid exposing
whether an email address already has an account. Session-aware SSR/private routes
require correct [origin and cookie configuration](development.md#origins-and-cookies).

New sign-ins receive the default account role. There is no public admin signup
or first-admin provisioning CLI; initial administration requires a controlled
operator procedure on the operator's own instance.

### Submission and moderation

Signed-in accounts submit a name, public GitHub repository, and optional website.
New intake is a private draft. Create/resubmit share five validated attempts per
ten minutes per account, including admins, and a cap of ten open drafts. Quota is
consumed before downstream duplicate, capacity, GitHub, state, or revision checks;
invalid/unauthenticated input does not consume it. Redis failure stops intake.

| State       | Visibility and workflow                                      |
| ----------- | ------------------------------------------------------------ |
| `draft`     | Private, waiting for review or admin enrichment              |
| `published` | Public and eligible for discovery                            |
| `rejected`  | Private, with required decision feedback for submitter/admin |
| `removed`   | Hidden from the public catalogue                             |

Admins enrich copy, content, media, and categories before publishing. Publication
requires the shared publish schema: valid identity/repository, logo, tagline,
description, and 1–3 leaf categories. Review history records decisions.

The original submitter can correct rejected intake from `/submission` using
**Edit & Resubmit**. Stale/non-rejected records conflict. Resubmission keeps the
project ID, slug, original submitter/date, and enriched content/media, clears the
current rejection reason, and returns the listing to draft. It grants no rights
to edit the published listing.

Actual Published/Rejected transitions queue email for the original submitter.
Admin-created projects without a submitter do not notify anyone. A separate
worker sends immutable decision snapshots with bounded retries; links lead to
current public/private state. Provider acceptance does not guarantee inbox
delivery. See [worker behavior](deployment.md#scheduled-workers).

### Project access and editing

Use `/<slug>?dialog=verify` to connect GitHub, check repository access, choose an
Owner/Maintainer label, and confirm a project contact email with an expiring code.
Email confirmation creates a pending request; independent approval is required.
An admin reviews the first representative; existing active representatives review
later requests. Self-approval is prohibited.

GitHub admin/maintain access is strong evidence. Write access and unverified
provider results require independent reviewer evidence. Confirmed read/triage/no
access or identity mismatch is denied; notes cannot override it. Approval obtains
fresh evidence. The catalogue metadata token never authorizes a claim.

Approved active members edit published project name, tagline, description,
website, Markdown, logo/screenshot, and categories from `/managed`. Changes
publish immediately after validation; stale saves conflict. They cannot change
repository identity, slug, visibility, provenance, taxonomy, featured selection,
or deletion. Upload grants are scoped to the account and project.

Members may leave, including the last representative. Only another admin can
change a member's label or revoke another account's membership. No direct
add/invite bypasses verification. Losing the last active representative removes
the verified badge and ranking benefit. Changing repository identity clears
membership/claims/upload grants; same-identity renames retain them.

### Bookmarks, reports, and featured projects

**Bookmarks:** `/bookmarks` is private to the signed-in account, including admins.
Save/remove are idempotent and lists contain published projects only. Hidden
projects retain private bookmarks and reappear if republished; project/account
deletion cascades them. No public bookmark counts or shared bookmarks exist.
Private named bookmark lists remain unscheduled. Public editorial collections are
separate.

**Reports:** `/<slug>?dialog=report` accepts Broken link, Wrong category, Outdated,
or Other. Guest contact is required but unverified; signed-in contact comes from
the session. Messages allow up to 2,000 characters; Other requires a message.
Limits are five validated attempts per ten minutes per account/guest email hash,
plus a shared guest cap of fifty. Admins resolve or dismiss Open reports at
`/admin/reports`; decisions do not change project data. No reopen, assignment,
report email, or automatic correction exists. Contact/message data stays private.

**Featured:** `/admin/featured` manages an ordered selection of up to 24 eligible
published projects. Save is explicit and detects concurrent changes. Public
project details omit the current project and unavailable entries. This selection
does not control homepage order.

### Public Collections

`/collections` and `/collections/<slug>` are public curated discovery pages,
separate from private bookmarks. Types are alternatives to a listed project,
ecosystems/toolchains around a listed project, and curated lists referencing a
GitHub source repository. The source list itself does not need a catalogue entry.
There is no synchronization: admins maintain membership and presentation order;
sequence numbers do not imply ranking or “best” claims.

Admins create, edit, delete, and publish at `/admin/collections`, with title,
description, slug, Markdown, and up to 100 distinct listed/published members.
Alternatives/ecosystems require a listed/published main project, which cannot also
be a member. Repository lists require an HTTPS GitHub repository URL and have no
main project. Missing projects use the existing submission workflow. Slugs are
unique; changing a slug changes the public URL. Publishing requires a member.
The title, description, and Markdown introduction are editorial fields, with no
generated title or introduction templates. Authorship is taken from the creating
admin's account; later editors cannot replace it or supply another author.
The written-by name is retained after edits and account deletion. The byline shows
the original writer's current account avatar and the collection's updated date;
missing or failed images fall back to initials. Account deletion removes the live
avatar association without removing the saved name. Revision checks prevent stale
saves/deletes from overwriting newer edits.
The management list refreshes after failed deletions so retries use the latest
revision or remove a record deleted elsewhere. Drafts have no public-page link.

The directory uses 45 display slots per page, shared with listing ads, with breadcrumbs and responsive
Prev/Next, numbered-page, and ellipsis navigation when more than one page exists.
The first-page URL is `/collections`; `?page=1` normalizes to that clean URL.
Later pages use `?page=N`. Cards show the collection title, description, type,
and available-project count. Their logo and faded, rotated background artwork use
the main project's live logo, or the source repository owner's avatar for
repository lists. The same card design is used for the more-collections section.

Public membership, media, descriptions, and documentation come directly from the
catalogue. Hidden/deleted members are omitted; collections with no available
members or an unavailable main project disappear from public pages and sitemaps.
Republishing a hidden project restores eligibility; deleted memberships cascade.
Drafts stay private. The public renderer handles Markdown with raw HTML disabled.
Each member displays its catalogue logo, name, description, available screenshot, and a
clipped documentation preview with a bottom fade and a Read more link to the full
project page.

Detail breadcrumbs lead through Home and Collections to the collection title.
Desktop alternatives/ecosystem pages show a main-project card with the same
rotated, blurred logo background; repository lists omit this card. Member side
navigation begins alongside the first project, highlights the active project on
scroll or click, and keeps that item visible within its own scrollable list.
Section headings stick beneath global navigation until the next project replaces
them. Navigation and the copy/share bar stop at the article boundary before more
collections and the footer. The missing-project action links to the existing
submission workflow. Mobile omits the main-project card and side navigation while
retaining member headings, previews, and sharing.

More collections are discovery links, not recommendations based on a score.
Their independent query starts alongside the main collection and never delays
the article. Cards appear when discovery completes; a pending or failed request
omits that section while the available collection remains readable.
Canonical metadata and sitemap entries use the same live public eligibility
rules. Changing a slug does not create a redirect for the old URL. Deployment
acceptance is still required for each instance.

Before rollout, a read-only check against the intended database detects existing
project slugs that collide with site routes, including `about` and `collections`. It runs
automatically before migration and blocks on any collision; operators must rename
affected projects and recheck before deploying the matching API/web revisions.

### Blogs and About

`/blogs` and `/blogs/<slug>` show published editorial posts. Admins manage posts
at `/admin/blogs` with title, slug, description, cover, Markdown, and draft or
published status. Drafts remain private. Publication records a date and estimated
read time; a revision check protects updates and deletion. Posts retain the
creating writer's name and use the account's current avatar when available.
Canonical metadata, social images, and sitemap entries follow publication state.
Changing a slug changes the public URL without adding a redirect.

`/about` is one public document with an admin editor at `/admin/about`. Its title,
description, and Markdown body are editable; saving publishes immediately. The
description also supplies search/social metadata. Before the first save, readers
see the initial AltStack copy without a database write. Concurrent first saves
and later stale updates conflict rather than overwrite another editor's work.
The editor preserves unsaved input after failure, offers a content preview, and
warns before leaving with changes.

Both use the existing public Markdown renderer with raw HTML disabled. BlockNote
is the admin authoring interface, not the public renderer. About has canonical
metadata and a sitemap entry; it is not a general-purpose CMS or a draft workflow.

Public Markdown and admin previews show favicons beside ordinary web links and
reveal link underlines on hover. Catalogue mentions retain their badges. Public
code blocks use transparent headers and bodies with custom One Light/One Dark Pro
syntax highlighting, including bold tokens and PowerShell support. Every block
has equally sized icon-only copy and word-wrap controls with tooltips. Wrapping
is off initially, is independent for each block, and preserves the copied source.
The editor's Paragraph menu supports changing a partially selected block to a
heading using the pointer or keyboard.

### Advertising and guest orders

`/advertise` offers one-month Core (US$15, Tier 1), Plus (US$29, Tier 2), and
Priority (US$55, Tier 3) packages. Prices are server-owned integer cents and are
copied into an order; renewals retain that order's agreed amount. Creating an
order requires an email and acceptance of `/advertise/terms`, not an account.
The response is generic and the private management link is sent only to the
supplied mailbox. Repeated pending orders for the same email/package coalesce.

The private page at `/advertise/manage` links to the matching Ko-fi package. The
advertiser uses the same contact email and includes the order reference. Opening
checkout does not confirm a payment. An admin verifies the receipt and amount,
then records a unique transaction reference. This records receipt of money, not
a charge, and concurrent/stale confirmations cannot add another paid period.
There is no automated Ko-fi reconciliation, stored card, recurring charge, or
automatic refund.

After confirmation, the advertiser submits a name, description, HTTP(S) website,
square logo, and horizontal artwork where required. Admins review at `/admin/ads`,
configure the CTA and button color, and approve, request changes, or reject with
feedback. First approval starts the campaign's rolling month; initial review
time does not consume it. Previously approved artwork stays live while revisions
are reviewed. Rejecting a first campaign is terminal and any refund is arranged
manually; rejecting a later revision preserves the approved campaign.

Renewal requests queue email and expose the payment instructions without
extending dates. A confirmed payment adds a month from the current end, or from
confirmation time if already expired. Renewals preserve explicit deactivation;
material revisions do not reset the period. Exact [UTC periods and operating steps](deployment.md#advertising-orders-and-campaigns)
are documented separately.

| Placement                            | Core | Plus | Priority |
| ------------------------------------ | ---- | ---- | -------- |
| Project and collection listing cards | Yes  | Yes  | Yes      |
| Collection detail sidebar            | Yes  | Yes  | Yes      |
| Public corner recommendation         | Yes  | Yes  | Yes      |
| Public header banner                 | No   | Yes  | Yes      |
| Project detail sidebar               | No   | Yes  | Yes      |
| Homepage sponsor grid                | No   | Yes  | Yes      |

Core and Plus have equal weight on shared placements; Priority has twice the
weight with the same dwell intervals. Deduplication and available inventory
constrain actual selections, so a weight is not a guaranteed impression/click
ratio. Ads are labeled, do not affect Recommended ranking or editorial featured
order, and yield their listing slots to organic content when blocked or missing.
There are no impression/click records or delivery guarantees.

Admins may separately create draft, active, or inactive calendar campaigns with
artwork, UTC scheduling, and revision checks. Campaigns linked to paid orders
cannot be edited or deleted through that manual calendar editor. Private links,
live removal, selection timing, and artwork handling are specified in
[advertising architecture](architecture.md#advertising-inventory-and-rendering).

### Sharing, indexing, and badges

Project pages provide share links and `?dialog=embed`. The image endpoint is:

```text
https://app.example.com/example-editor/badge.svg?theme=dark&width=200&height=50
```

Theme is `dark` or `light`; width is an integer 160–1200 and height 40–400.
Defaults are dark/200/50. Invalid dimensions return 400. Badge responses recheck
publication on every request, including HEAD; hidden/missing projects return
404 and service failure returns retryable 503. Images are self-contained SVG
with no-store responses.

Canonical/OG URLs use configured `VITE_APP_URL`. Public pages have metadata,
structured data, robots rules, and live sitemaps. Search/nondefault-sort variants
are noindex; private routes and error pages are noindex. Dynamic social images
recheck visibility; third-party crawler caches remain outside application control.

### Admin workspace and limits

`/admin` shows current counts and eligible submission/report/claim queues.
`/admin/submissions`, `/admin/ownership`, `/projects`, and taxonomy/user pages
provide the corresponding workflows. `/admin/activity` displays only recorded
audit actions and safe metadata; it does not invent report/taxonomy events.

`/admin/users` supports protected role changes, bans/unbans, session revocation,
and membership navigation. Self-ban and changes that remove the last active admin
are blocked. Role changes revoke target sessions. Bans prevent account access and
exclude retained memberships from active verification; unban permits new sign-in.
There is no account deletion, impersonation, or manual account/email creation UI.

`/admin/operations` shows GitHub snapshot freshness and aggregate review-outbox
state. These observations do not prove scheduler execution or inbox delivery.
The dashboard has no job/retry execution controls or historical analytics.

## Quality and operational requirements

- Validate inputs and permissions on the server; conceal foreign private records
  and avoid shared caching of authenticated/private responses.
- Preserve user input on recoverable failures. Avoid automatic retries for writes
  whose earlier response may have been lost; detect stale revisions.
- Keep keyboard/mobile navigation, readable content, focus restoration, and
  loading/error/retry states usable across the main journeys.
- Use stored repository snapshots on public reads. Display missing/stale data
  honestly and never synthesize historical observations.
- Ship reviewed forward migrations and compatible API/web revisions. Verify
  scheduler execution, backup restore, and provider acceptance per instance.
- Keep public docs reproducible with synthetic examples. Production configuration,
  evidence, identities, and secrets belong in private operator storage.

## Scope boundaries

The current product does not include automated ad-payment confirmation,
subscriptions/automatic renewal, automatic refunds, impression/click analytics,
private named bookmark lists, ratings, reviews/follows, a personalized feed,
report conversations, or historical product analytics. Additional search
infrastructure, SDKs, newsletters, galleries, and extensions require a
demonstrated user problem and a separately scoped outcome.
See [conditional roadmap work](roadmap.md#conditional-product-work).

## Success signals

Evaluate whether people find relevant projects, use the upstream links, return to
saved shortlists, and can correct inaccurate listings. Track catalogue accuracy,
review/report backlog, metadata freshness, and successful representative edits
using an explicitly chosen measurement process. No numerical growth targets or
historical analytics are claimed by this document.
