# Custom ads

Campaigns and guest advertising orders are managed at `/admin/ads` through the existing admin role and oRPC middleware. The manual campaign editor still supports drafts, artwork upload, scheduling, activation/deactivation and deletion with optimistic versions. No production campaigns are seeded.

## Guest orders and manual payment

`/advertise` offers **Core US$15**, **Plus US$29**, and **Priority US$55** for one month. They map to Tier 1, Tier 2 and Tier 3 respectively. Prices are server-owned integer cents, copied into each order so renewals keep that order's agreed rate. Payment is coordinated by email. No payment gateway, card collection, checkout, subscription, automatic renewal or automatic refund is implemented.

1. The advertiser chooses a package, supplies an email and accepts `/advertise/terms`. No account is required. The endpoint returns generic success and sends the private link only to that mailbox, so entering another person's email does not grant access. Repeated pending orders for the same email/package coalesce.
2. The team receives an order notification and coordinates payment by email. Currency conversion and the final payable amount are agreed in that correspondence; the site does not invent exchange rates or payment destinations.
3. An admin independently verifies receipt and records a unique payment reference. This records a confirmation, not a money movement. The immutable payment record stores the order price, initial/renewal kind, confirming admin and timestamp. References are unique ignoring case. Concurrent/stale confirmations fail without adding a second period.
4. Once payment is confirmed, the advertiser uploads name, description, HTTP(S) website, square logo and a 3:1 horizontal wordmark for Plus/Priority. Core reuses the logo for its unused sponsor artwork field. Guest upload operations require a paid order and a valid private link; ownership is checked before promotion, replacement or deletion.
5. The admin previews the materials, configures CTA text and brand button color, and approves or requests changes. First approval creates an active campaign in the existing inventory. A decline before first approval is terminal; the team arranges any refund manually by email, and no automatic refund is claimed. Declining a later revision preserves the previously approved campaign.

Guest campaigns use a rolling **one-month period from first approval**, at the same UTC time/day of the following month, clamped to that month's final day. For example January 31, 2028 at 12:30 UTC ends February 29 at 12:30 UTC, exclusive. Review delays before first approval do not consume this period. Later material edits/approvals preserve the dates. Previously approved artwork remains available while a revision is reviewed.

The advertiser requests another month from `/advertise/manage`. This queues email and does not extend dates. A new payment confirmation adds a month from the existing end, or from confirmation time if the period already expired. Months are clamped sequentially (January 31 → February 28 → March 28 in a non-leap year). A renewal preserves explicit admin deactivation; activating/deactivating an order campaign is a separate control. Expiry uses the existing public inventory filters, with no expiry cron required. Linked campaigns cannot be edited/deleted through the calendar campaign editor, which would overwrite their paid dates or reviewed artwork.

Private management links use an order-bound HMAC, a per-order nonce, and a 24-hour lifetime. Credentials travel in a URL fragment, are captured into tab `sessionStorage`, and are removed from the address bar. They are sent in RPC bodies, never query strings or TanStack Query keys. Private order data stays in component state. `/advertise/manage` has noindex/no-referrer headers and meta, and omits public ad placements. Billing RPC responses use `private, no-store`. Fresh links can be requested by email; responses are identical for known/unknown addresses. Creation/recovery/upload quotas use the existing atomic Postgres limiter. The latest ten orders for a mailbox receive recovery links.

Configure existing `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and trusted `EMAIL_APP_URL`. Set **`ADS_CONTACT_EMAIL` to a monitored inbox** for staff notifications and advertiser replies; it defaults to the configured sender. No inbound email automation is added. Orders fail closed when email delivery configuration is missing/invalid. The API server drains the durable email outbox every 30 seconds (10 messages per batch); keep a server instance running. Multiple instances use database leases and stable provider idempotency keys. Payloads are frozen before sending, failures retry up to eight attempts within 23 hours, and exhausted records remain `failed` for operator inspection. Email bodies/private links are never emitted by the worker logger. A new recovery request creates a fresh link after an exhausted/expired message. Resend delivery and real payment receipt still require normal operational verification.

Apply the additive Drizzle migration before starting the updated API server. No gateway credentials are needed. The admin's displayed payment history is a record of manual confirmations, not an automated bank reconciliation or tax invoice.

## Periods and eligibility

Manually created campaigns begin at 00:00 UTC on the first day of `startMonth`. Duration is 1–24 calendar months; `endsAt` is exclusive at 00:00 UTC on the following month boundary. For example, December + 2 months runs December 1 through February 1 exclusive. Guest orders use the rolling period described above. Draft and inactive campaigns never qualify. The public API independently filters status/start/end using server time.

| Placement                            | Tier 1 | Tier 2 | Tier 3 |
| ------------------------------------ | ------ | ------ | ------ |
| Project and collection listing cards | Yes    | Yes    | Yes    |
| Collection detail sidebar            | Yes    | Yes    | Yes    |
| Public corner recommendation         | Yes    | Yes    | Yes    |
| Public header banner                 | No     | Yes    | Yes    |
| Project detail sidebar               | No     | Yes    | Yes    |
| Homepage sponsor grid                | No     | Yes    | Yes    |

Tier 1 and Tier 2 have equal base selection weight on shared placements. Tier 3 has weight 2, with the same dwell/selection intervals. Selection is weighted sampling without replacement within a listing. Advertiser identity for deduplication is the normalized website hostname (ignoring `www.`); use one domain per advertiser. Multiple campaigns for the same advertiser do not occupy several listing cells. Sponsor grid displays one cell per eligible advertiser in stable creation/ID order.

Listing renewal prefers advertisers outside the previous set when inventory permits, otherwise requires at least one fresh advertiser when possible. Sampling among candidates remains weighted, but uniqueness and set avoidance constrain aggregate ratios. With three advertisers and three listing slots, every advertiser appears once; a 2:1 ratio cannot be forced. Banner/detail/corner sampling does not force alternation, which would erase weights for a two-advertiser inventory. Repeated selection of the same advertiser is possible. There are no impression, click or analytics records; selection is not a viewed impression. Payment confirmations are separate from ad selection.

## Session timing and removal

Banner, both detail placements and the listing set store campaign IDs and the original selection timestamp in `sessionStorage`, shared across routes and normal reloads within the tab. The minimum selection TTL is 180 seconds. Navigation after TTL selects again; a stationary page does not automatically swap these placements. Inventory is fetched on navigation, every 5 seconds while visible, and when window focus returns. Eligibility always filters selected IDs, irrespective of their TTL. Server time is used to anchor a local 1-second expiry check. Expired ads disappear within that check interval; remote deactivation/deletion takes effect on the next successful inventory refresh (normally within 5 seconds). Inventory errors fail closed. Background browser timer throttling and offline clients cannot provide instantaneous remote updates.

Corner samples every 15 seconds with a 200 ms exit before the next sample, then enters from below. Hover, keyboard focus, hidden tabs and the explicit pause button suspend timers. Resume begins a fresh dwell, with no catch-up burst. The separate minus button dismisses the corner for the tab session, across navigation/reload. Reduced motion disables the movement. Storage-denied environments retain state in memory for the current document; reload persistence cannot be promised there.

## Listing capacity and pagination

A full catalogue page has 45 display slots. Desktop has three columns and ad positions **3, 18, 33**. Mobile (<768px) uses **3, 15, 29**, intentionally not normalized. Tablet uses two columns with desktop flattened positions. Three ads consume three slots, leaving 42 catalogue items. Missing inventory backfills with catalogue items. Responsive reflow changes insertion positions without reselecting advertisers or restarting TTL. Short final pages do not invent filler items or trailing ad-only rows.

The API accepts an optional content `offset`; the route loaders request 45 organic candidates. A session ledger, partitioned by catalogue filters/sort, records actual content consumed on each page. The next page begins at that recorded end, rather than multiplying page number by a changing page size. For example, 3 ads on page 1 consumes items 0–41; a subsequent blocked page starts at 42 and consumes 45 items; the following page starts at 87. This prevents skipped/duplicated content across sequential pagination when ad availability changes. SSR uses canonical 45-item boundaries, then the client restores session boundaries before rendering a differing range. Query keys include the resolved offset so prefetched results for a different boundary are not reused.

Unvisited page jumps use the nearest known boundary plus 45 items per unvisited page. Revisiting a page whose capacity changes invalidates downstream ledger boundaries for the new traversal. Back navigation naturally revisits content. Session boundaries do not snapshot catalogue data: concurrent insertions, removals or ranking changes retain the existing offset-pagination limitations. Canonical URLs remain numbered, shareable catalogue pages; a new tab starts with canonical organic boundaries.

Only actual ad elements are observed for cosmetic hiding; hidden ads are removed and their slots backfilled. There is no bait request, proxy, renamed retry endpoint, ad-blocker bypass, or attempt to restore hidden ads. If `/ads` is blocked or unavailable, the catalogue renders organic content. A blocker that hides an entire content ancestor is respected.

## Layout and artwork

UI follows AltStack's existing cards, semantic theme tokens, typography and focus treatment (energy/rhythm/motion 1/1/1). The Ad badge identifies paid content; the faint logo repeats existing project-card artwork. External arrows identify outbound CTA links. The banner is one link below the fixed header and scrolls with the document. Mobile omits the separate Learn more label. Sponsor cells use horizontal artwork, hover/focus tooltips and native disclosures for keyboard/touch access.

The same card renders listing and detail ads. Desktop detail cards stick with the existing sidebar, above featured projects or the collection member navigation. On mobile the sidebar card stays in document flow, after the article, so it does not cover content. Corner has safe-area spacing and reserves its measured height after the footer on mobile. Its controls remain visible on mobile and reveal on desktop hover/focus.

Admin explicitly configures the logo's brand color for the CTA; the fallback is `#2563eb` (no automatic image palette extraction). Black or white text is selected by WCAG luminance contrast. Both artwork fields use the existing admin presigned upload/crop flow. Saving verifies MIME/size, copies to a unique permanent `ads/{ownerId}/` object and verifies the copy (`campaignId` for manual campaigns, `orderId` for guest materials awaiting review). Successful writes remove temporary/replaced objects; failures clean promoted copies and leave temporary sources retryable. S3 cleanup is best effort, consistent with existing storage. Apply the generated Drizzle migration through the normal database release process. No deployment or production migration is performed by this implementation.

The order/pricing interfaces reuse the existing fields, upload/crop components, buttons, badges and semantic theme tokens. No new decorative assets or traffic claims are introduced. The package comparison lists real placement differences; payment confirmation and material approval remain separate, explicit admin actions.

## Validation and delivery review

Validation uses synthetic test campaigns, mocked S3 calls and disposable PostgreSQL schemas, never production inventory. No full repository test suite was run. Payment and email delivery tests use mocked provider operations. No real email, payment, or refund was issued during validation. The additive migration was applied to the local development database after passing isolated database tests; production deployment remains separate.

- **Hard gate PASS:** admin create/edit/delete/error paths are exercised in DOM tests; exact responsive insertion, full backfill and horizontal overflow are checked in Chromium at 390/800/1280px; outbound links are labeled sponsored and contain no nested anchors. No production advertiser assets, testimonials or performance claims are fabricated.
- **Purpose gate PASS:** the Ad badge discloses sponsorship, the external arrow identifies an outbound CTA, faint artwork follows existing AltStack project cards, and corner motion signals a recommendation change. No new decorative asset set or marketing sections are introduced.
- **Liveliness PASS:** energy/rhythm/motion 1/1/1 follows the existing catalogue; card borders, muted descriptions and logo treatment retain AltStack's visual language. Sponsor cells use advertiser artwork rather than invented endorsements.
- **Craftsmanship PASS:** tests cover UTC month boundaries, 1:1:2 sampling, TTL persistence/navigation, live removal, unique inventory, content offsets, cosmetic blocking, hover/focus/visibility/pause/dismissal, SSR hydration, CRUD authorization/conflicts and asset cleanup. Existing featured/sidebar and collection browser tests also pass. Scoped formatting, lint, typechecks and the production web build verify integration. This is targeted engineering validation, not a claim of a complete WCAG certification or a live production S3 test.

### Manual-order validation

The targeted checks for guest/manual orders passed: 100 API/database/OpenAPI tests; 39 web unit tests for ordering, private access, admin review and ad regressions; 5 SEO tests; 11 API-server privacy/CORS tests; and 4 Chromium layout/backfill tests at 390/800/1280px. These use mocked mail/storage and disposable PostgreSQL schemas. Coverage includes signed-link expiry/tampering, storage-denied Strict Mode access, separate payment/review authorization, concurrent payment confirmation, duplicate payment references, upload ownership, first-approval month boundaries, revision preservation, renewal after expiry, durable mail leases/retries and escaped feedback.

Scoped format/lint and typechecks cover web, server, API, database, shared schemas, environment and UI. API/server/web production builds pass; upstream bundler warnings about chunk sizes and module directives remain. No complete repository suite, real email delivery or live payment was run. Existing compact corner controls and banner spacing are retained; browser assertions check header clearance and usable compact control targets rather than the old fixed pixels.
