# Custom ads

Campaigns are managed at `/admin/ads` through the existing admin role and oRPC middleware. Create a draft, upload a square logo and 3:1 horizontal wordmark, enter advertiser copy and HTTP(S) website, configure the CTA, tier, status and month, then save. Edit supports activation/deactivation, scheduling and renewal. Deletion requires confirmation. Optimistic versions reject stale edits/deletes. No production campaigns are seeded.

## Periods and eligibility

A campaign begins at 00:00 UTC on the first day of `startMonth`. Duration is 1–24 calendar months; `endsAt` is exclusive at 00:00 UTC on the following month boundary. For example, December + 2 months runs December 1 through February 1 exclusive. Draft and inactive campaigns never qualify. The public API independently filters status/start/end using server time.

| Placement                            | Tier 1 | Tier 2 | Tier 3 |
| ------------------------------------ | ------ | ------ | ------ |
| Project and collection listing cards | Yes    | Yes    | Yes    |
| Collection detail sidebar            | Yes    | Yes    | Yes    |
| Public corner recommendation         | Yes    | Yes    | Yes    |
| Public header banner                 | No     | Yes    | Yes    |
| Project detail sidebar               | No     | Yes    | Yes    |
| Homepage sponsor grid                | No     | Yes    | Yes    |

Tier 1 and Tier 2 have equal base selection weight on shared placements. Tier 3 has weight 2, with the same dwell/selection intervals. Selection is weighted sampling without replacement within a listing. Advertiser identity for deduplication is the normalized website hostname (ignoring `www.`); use one domain per advertiser. Multiple campaigns for the same advertiser do not occupy several listing cells. Sponsor grid displays one cell per eligible advertiser in stable creation/ID order.

Listing renewal prefers advertisers outside the previous set when inventory permits, otherwise requires at least one fresh advertiser when possible. Sampling among candidates remains weighted, but uniqueness and set avoidance constrain aggregate ratios. With three advertisers and three listing slots, every advertiser appears once; a 2:1 ratio cannot be forced. Banner/detail/corner sampling does not force alternation, which would erase weights for a two-advertiser inventory. Repeated selection of the same advertiser is possible. There are no impression, click, analytics or payment records; selection is not a viewed impression.

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

Admin explicitly configures the logo's brand color for the CTA; the fallback is `#2563eb` (no automatic image palette extraction). Black or white text is selected by WCAG luminance contrast. Both artwork fields use the existing admin presigned upload/crop flow. Saving verifies MIME/size, copies to a unique permanent `ads/{campaignId}/` object and verifies the copy. Successful writes remove temporary/replaced objects; failures clean promoted copies and leave temporary sources retryable. S3 cleanup is best effort, consistent with existing storage. Apply the generated Drizzle migration through the normal database release process. No deployment or production migration is performed by this implementation.

`/advertise` describes inventory without inventing prices, advertiser claims, contact addresses or a payment flow; outreach/contact can be configured when the team supplies its preferred channel.

## Validation and delivery review

Validation uses synthetic test campaigns, mocked S3 calls and disposable PostgreSQL schemas, never production inventory. No full repository test suite was run. The web build uses non-working test provider configuration; real bucket credentials and deployment remain part of the normal environment setup.

- **Hard gate PASS:** admin create/edit/delete/error paths are exercised in DOM tests; exact responsive insertion, full backfill and horizontal overflow are checked in Chromium at 390/800/1280px; outbound links are labeled sponsored and contain no nested anchors. No production advertiser assets, testimonials or performance claims are fabricated.
- **Purpose gate PASS:** the Ad badge discloses sponsorship, the external arrow identifies an outbound CTA, faint artwork follows existing AltStack project cards, and corner motion signals a recommendation change. No new decorative asset set or marketing sections are introduced.
- **Liveliness PASS:** energy/rhythm/motion 1/1/1 follows the existing catalogue; card borders, muted descriptions and logo treatment retain AltStack's visual language. Sponsor cells use advertiser artwork rather than invented endorsements.
- **Craftsmanship PASS:** tests cover UTC month boundaries, 1:1:2 sampling, TTL persistence/navigation, live removal, unique inventory, content offsets, cosmetic blocking, hover/focus/visibility/pause/dismissal, SSR hydration, CRUD authorization/conflicts and asset cleanup. Existing featured/sidebar and collection browser tests also pass. Scoped formatting, lint, typechecks and the production web build verify integration. This is targeted engineering validation, not a claim of a complete WCAG certification or a live production S3 test.
