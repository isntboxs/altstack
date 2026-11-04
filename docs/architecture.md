# Architecture

AltStack is a TypeScript workspace with a server-rendered web app, a separate
API, and scheduled workers. PostgreSQL stores catalogue and private workflow
data; Redis provides shared intake quotas; object storage holds media.

## Request flow

1. The browser reaches `apps/web`, built with React, TanStack Start/Router/Query,
   and Nitro. File routes live in [src/routes](../apps/web/src/routes), while
   feature queries and UI live in [src/features](../apps/web/src/features).
2. The browser calls the typed oRPC API with credentials. SSR invokes the same
   routers in-process with context derived from request headers, as defined in
   [orpc.ts](../apps/web/src/utils/orpc.ts). Cookie scope still matters for API
   authentication and SSR; see [origins and cookies](development.md#origins-and-cookies).
3. [apps/server/src/index.ts](../apps/server/src/index.ts) mounts Hono middleware,
   Better Auth, RPC, and the generated OpenAPI interface on Bun.
4. API procedures validate inputs, derive the caller from the session, enforce
   permissions, and execute queries/transactions through Drizzle.
5. Scheduled server CLIs refresh GitHub snapshots and deliver committed review
   notifications. The request server does not start those schedules. Advertising
   email is a separate durable outbox drained by the API process every 30 seconds.

## Package boundaries

| Package  | Responsibility and entry points                                                                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `api`    | [Contracts](../packages/api/src/contracts), [routers](../packages/api/src/routers), [queries](../packages/api/src/queries), provider adapters, and outbox delivery |
| `auth`   | [Server policy](../packages/auth/src/server/config.ts), sessions, OAuth, Magic Links, account access, and claim email delivery                                     |
| `db`     | [Schema exports](../packages/db/src/schemas.ts), relations, migrations, transactional file imports, and disposable test schemas                                    |
| `env`    | Server-only configuration and public web build configuration                                                                                                       |
| `shared` | [Schemas](../packages/shared/src/schemas), constants, repository normalization, license and star comparison helpers                                                |
| `ui`     | Interactive components, styles, and isolated [email templates](../packages/ui/src/emails)                                                                          |

Keep auth-server, database, storage credentials, email sending, and native image
decoding out of browser imports. Email components accept data and render HTML/text;
they do not load environment variables or call providers.

## API surfaces

| Prefix           | Purpose                                                |
| ---------------- | ------------------------------------------------------ |
| `/api/auth/*`    | Better Auth sign-in, callbacks, sessions, and sign-out |
| `/api/rpc/*`     | Typed oRPC procedures used by the web app              |
| `/api/reference` | API reference and explicitly mapped HTTP operations    |

Contracts define paths, methods, detailed input sections, and output validation.
Read operations use HTTP **`QUERY`**, including the health operation; do not assume
`GET`. Confirm proxy/CORS support for this method. For example:

```sh
curl --request QUERY http://localhost:3009/api/reference/health
```

RPC-only compatibility operations are omitted from OpenAPI. Authentication uses
cookies, and private operations independently enforce permissions on the server.
See [contracts/index.ts](../packages/api/src/contracts/index.ts) and
[handler.ts](../packages/api/src/handler.ts) for the authoritative mappings.

## Data and consistency

- `projects` owns listing identity, content, visibility, and submission provenance.
  `github_repositories` and `github_star_history` hold observed repository data.
- Category hierarchy/path history and project assignments support canonical URLs
  and stable redirects. Tags reflect GitHub topics with separate admin curation.
- Bookmarks, reports, claims, memberships, upload grants, and auth records are
  separate private models. Submission provenance does not grant membership.
- `audit_log` records supported lifecycle/access actions. The admin activity feed
  returns an explicit safe projection rather than raw metadata.
- `submission_review_notifications` is a durable private outbox tied to committed
  moderation events. Notification creation and the decision commit together.
- Collections retain editorial copy, ordered catalogue membership, original
  authorship, and a revision independently of project content. `blog_posts`
  retains editorial Markdown, cover, publication state, byline, and a revision.
- `about_page` is a singleton. Reads return the initial shared copy at version
  zero until the first save; an insert or conditional update atomically advances
  the revision. Concurrent first saves and stale later updates return conflicts.
- `ad_campaigns` stores public inventory. `ad_orders`, `ad_payments`, `ad_uploads`,
  and `ad_notifications` hold private order state, immutable manual receipt
  confirmations, upload ownership, and durable delivery. A case-insensitive unique
  payment reference and order revision/row lock prevent duplicate paid periods.

Transactions and shared locks protect taxonomy changes, draft capacity,
repository identity conflicts, membership decisions, and last-admin availability.
Revision checks reject stale edits. External GitHub/storage calls run outside
long write transactions; authoritative conditions are checked again before commit.
The import CLI shares the category integrity lock with API writers.

## Recommended ranking

Recommended is the homepage's default order. PostgreSQL computes it from stored
GitHub metadata and eligible project membership before pagination. Other explicit
sorts and the category/tag/license default of Most stars are separate. Featured
positions, collection member positions, and advertising selection do not enter
the formula. Policy constants and the SQL expression live in
[project-ranking.ts](../packages/api/src/queries/project-ranking.ts).

```text
popularity = 0.5 × ln(1 + stars) / ln(1 + 10,000)
           + 0.5 × ln(1 + forks) / ln(1 + 1,000)

ageFactor = 1 − 0.5 × min(repositoryAgeDays / 1826.25, 1)

activityFactor = 0.5 ^ (max(daysSinceLastCommit − 90, 0) / 180)

score = popularity × ageFactor × activityFactor
        × (verified ? 1.05 : 1)
        × (archived ? 0.1 : 1)
```

Stars and forks have equal weights at their fixed reference counts. Logarithms
reduce the advantage of very large repositories. References are policy values,
not maxima from the current result set, so filtering does not change a project's
underlying score. Popularity can exceed one; this is not a percentage score.

Age uses repository creation, never listing submission. Its factor falls from
one to one-half over five years and stays there. Activity has a 90-day grace
period, then halves every 180 additional days without a commit. Archived projects
retain 10% of their otherwise calculated score and remain visible.

Verification uses the eligible-member check. Losing eligible membership removes
the 5% bonus without a score-refresh job; verification does not guarantee first
position. Missing and future data are handled explicitly:

- Unknown repository creation has a neutral age factor of one.
- Unknown last commit without a completed metadata fetch has a neutral activity
  factor of one; missing metadata is not evidence of inactivity.
- A completed fetch with no commit means an empty repository under the current
  GitHub fetch contract; its activity factor is zero.
- Future timestamps use zero elapsed days, preventing factors above one.
- Zero stars and forks produce a zero score even for verified listings.

Reference time is midnight in Asia/Jakarta, matching the GitHub snapshot calendar.
Time-based factors stay constant within that day, but a successful metadata or
membership change can change order immediately. Separate requests do not share
a frozen database snapshot. Every ordering ends with project ID descending for
ties. There is no stored score column, scoring migration, extra GitHub fetch, or
scheduled scoring job.

## Public rendering and media

Public reads select published records and explicit public fields. Private feedback,
report contacts, claim evidence, and auth data do not enter public projections.
Session-aware SSR HTML is private/no-store. Route guards help navigation; they
do not replace API authorization.

Markdown rendering supports GFM, project mentions, and server-prepared highlighted
code through [PublicContent](../apps/web/src/components/public-content/index.tsx).
Public blog, collection, and About bodies use that renderer with raw HTML disabled;
BlockNote is used for admin authoring. README import normalizes repository-relative links and drops unsupported
unsafe markup. Storage uploads start as temporary objects and are validated and
promoted before final keys are persisted; member grants bind uploads to account
and project.

The [SEO feature](../apps/web/src/features/seo) builds canonical URLs from public
configuration, serves sitemap/robots routes, and renders social images with local
fonts/artwork. Dynamic images and badges check current public visibility and use
no-store responses. Social platforms may cache their own copies.

## Advertising inventory and rendering

Public inventory independently filters campaign status, start, end, and placement
eligibility using server time. Draft and inactive campaigns do not qualify. Core
and Plus have base weight one on shared placements; Priority has weight two.
See the [PRD placement table](prd.md#advertising-and-guest-orders) for tier access
and [deployment](deployment.md#advertising-orders-and-campaigns) for paid periods.
Selection policy is implemented in
[selection.ts](../apps/web/src/features/ads/selection.ts).

Sampling is weighted without replacement within a listing. Normalized website
hostname, ignoring `www.`, defines advertiser identity, so overlapping campaigns
for one advertiser cannot occupy multiple listing cells. The sponsor grid shows
one cell per eligible advertiser in stable creation/ID order.

After the listing TTL, selection prefers advertisers outside the previous set
when possible, or at least one fresh advertiser when available. Uniqueness and
set avoidance constrain aggregate ratios: three advertisers in three slots all
appear, regardless of their weights. Banner, detail, and corner samples do not
force alternation. Selecting an ad is not a recorded viewed impression; there
are no impression, click, or analytics records.

### Session timing and live removal

Banner, detail placements, and the listing set retain selected IDs and the
original timestamp in tab `sessionStorage`. The minimum TTL is 180 seconds.
Navigation after TTL selects again; a stationary page does not automatically
swap those placements. Storage denial falls back to current-document memory,
without a promise of reload persistence.

Inventory refreshes on navigation, every 10 seconds while visible, and on focus.
Hidden tabs do not poll. Selected IDs are always checked for eligibility, even
inside TTL. Server time anchors a local one-second expiry check; expired ads
disappear on that check, while remote deactivation/deletion is observed on the
next successful refresh. Inventory failures fail closed. Timer throttling and
offline clients prevent instantaneous remote removal. A continuously visible tab
normally makes six periodic inventory requests per minute, plus navigation/focus
requests.

The corner samples every 15 seconds, with a 200 ms exit before the next sample.
Hover, keyboard focus, hidden tabs, and the pause control suspend timers. Resume
starts a fresh dwell without a catch-up burst. Dismissal lasts for the tab
session across navigation/reload. Reduced motion disables movement.

### Listing capacity and pagination

A full catalogue page has 45 display slots. Desktop uses three columns and ad
positions 3, 18, and 33. Mobile below 768px uses 3, 15, and 29; tablet has two
columns with desktop flattened positions. Three ads leave 42 catalogue items;
missing inventory backfills with organic items. Responsive reflow changes
positions without reselecting advertisers or restarting TTL. Short final pages
do not add filler items or trailing ad-only rows.

API queries accept an optional organic `offset`; route loaders request 45
candidates. A session ledger partitioned by catalogue filters/sort records actual
consumption. If page one consumes items 0–41, the next starts at 42. If that page
then has no ads and consumes 45 items, the following page starts at 87.
SSR and initial hydration use canonical 45-item boundaries. The client restores
session boundaries afterward through
[useCatalogueOffset](../apps/web/src/features/ads/use-catalogue-offset.ts), which
uses an explicit server snapshot. Query keys include the resolved offset, so
prefetched results for another boundary cannot be reused.

Unvisited jumps use the nearest known boundary plus 45 items per unvisited page.
A changed capacity on a revisited page invalidates downstream boundaries. Back
navigation naturally revisits content, and a new tab starts from canonical
boundaries. The ledger does not snapshot catalogue data; concurrent inserts,
removals, and ranking changes retain offset-pagination limitations.

Only actual ad elements are observed for cosmetic hiding. Hidden ads are removed
and their slots backfilled; the application does not use bait requests, proxies,
renamed retry endpoints, or other ad-blocker bypasses. If `/ads` is unavailable,
the catalogue renders organic content. Hiding a whole ancestor is respected.

### Layout and artwork

The banner sits below the fixed header and scrolls with the document; mobile
omits its separate CTA label. Sponsor cells use horizontal artwork with
hover/focus tooltips and native disclosures for keyboard/touch. Listing and
detail placements share the ad card. Desktop detail ads stick above featured
projects or member navigation; mobile keeps them in article flow. The corner
uses safe-area spacing and reserves its measured height after the mobile footer.
Controls remain visible on mobile and reveal on desktop hover/focus.

Ads use the existing theme tokens, card and focus treatment, with an Ad label
and outbound sponsored links. Admins explicitly choose CTA text and brand button
color; the fallback is `#2563eb`. Black or white text is selected by luminance
contrast, without automatic image palette extraction.

Logo and banner fields reuse the presigned upload/crop flow. Saving verifies
MIME/size, promotes to a unique `ads/{ownerId}/` key, and verifies the copy. The
owner ID is a campaign for manual inventory or an order for guest material.
Successful writes remove temporary/replaced objects; failures remove promoted
copies while retaining retryable temporary sources. Cleanup remains best effort.

### Private order access

Management links use an order-bound HMAC, per-order nonce, and 24-hour lifetime.
Credentials arrive in the URL fragment, move to tab `sessionStorage`, and are
removed from the address bar. RPC bodies carry the credentials; query strings
and TanStack Query keys do not. Private order data stays in component state.
`/advertise/manage` is noindex/no-referrer and omits public ad placements; billing
responses are private/no-store. Creation, recovery, and upload quotas use atomic
PostgreSQL limits. Recovery responses are generic and send fresh links for the
mailbox's latest ten orders. Paid state and upload ownership are checked before
promotion, replacement, or deletion. No inbound email automation is implemented.

## Changing a feature

Trace the shared schema → contract → authorized router/query → web consumer →
targeted tests. Include migrations for persistence changes and update the relevant
guide. For runtime configuration or worker changes, also update
[configuration](development.md#configuration) and [deployment](deployment.md).
