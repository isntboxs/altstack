# Project verification and owner/maintainer editing

R6a and R6b are implemented together from local `dev` (`e98a4c1`). This is local
implementation and acceptance evidence, not production deployment. The user
confirmed the policy on 2026-10-24; it supersedes the old GitHub-only claim plan.

## Claim policy and lifecycle

Sign in with either existing method. Open `/$slug?dialog=verify`, enter a project
contact email and choose Owner or Maintainer. Both roles have identical access.
The contact email may differ from the account email: confirming it neither
changes the login email nor links or merges accounts.

The six-digit email code proves inbox control. It creates a pending access
request, not membership. A different AltStack admin reviews the first request
when a project has no representatives. Once a project has representatives,
either approved role reviews additional requests in **My projects → Access
requests**. The reviewer must independently confirm the claimant represents the
project; email proof alone is insufficient. Self-approval is prohibited, including
for admins. A rejected claimant can confirm details and request a new code.

Project-row locks serialize decisions. If two first claims are approved
concurrently, the first approved representative wins bootstrap; the other request
then needs a representative's review. A second decision on a changed request
cannot silently overwrite the first. Unpublished/deleted projects cannot accept
claims or edits; pending requests are hidden from the review inbox while hidden.

`project_members` records account, project, role, approver and approval time.
`projects.submitter_id` remains submission provenance and grants no edit rights.
Existing projects/users gain no membership during migration. Account/project
deletion cascades memberships, claims and temporary-upload records. Verification
is derived from membership existence, so deleting the last representative removes
the badge/ranking benefit. When an admin changes a listing to a different GitHub
repository identity, membership, outstanding claims and upload grants are cleared;
same-identity repository renames retain them. Global role labels alone never
grant project rights, including after such cleanup.

## Permissions and editing

Better Auth 1.7.12's access control registers `owner` and `maintainer` with the same
`project.update` and `project.review-claim` permissions. The server checks the
approved role on the requested project's membership; a role held on another
project is irrelevant. Claim approval preserves an admin's global role. A user
who represents multiple projects can have different membership labels; the
global account label preserves owner/admin when another claim is approved.

`/managed` lists approved, published projects and the reviewable requests. Its
editor immediately publishes name, tagline, description, website, Markdown
content, logo/screenshot and 1–3 valid leaf categories. It reuses the established
category picker, BlockNote editor, crop/upload controls, publication validation
and final-media promotion. Revision checks reject stale saves. Audit records
identify claim requests/decisions and member edits without email/code payloads.

These roles cannot change repository identity, slug, visibility, submission
provenance, rejection feedback, taxonomy, Featured selection, reports or deletion.
The admin API/upload endpoints remain admin-only. Route guards improve navigation;
every private API, upload/delete and media-consumption operation checks membership
and current publication independently.

Member uploads receive random temporary keys in the existing lifecycle prefixes.
The private `project_uploads` ledger binds a key to its account and project;
knowing another key does not permit deletion or promotion. Existing image MIME,
size and stored-object validation is reused. Failed promotions clean up copies;
consumed/expired uploads prompt re-upload. Permanent media never goes through
temporary-upload delete endpoints. Storage still needs the baseline `tmp/*`
lifecycle; unconsumed ledger records are harmless grants limited to their account
and project and disappear with those records. They can be pruned after the
24-hour temporary-object retention window during routine DB maintenance.

## Public behavior

The small warm verified icon appears beside project names in catalogue cards,
detail and public hover previews, including saved project rows. Verify disappears
after approval. Approved members see Manage project; other visitors can Request
access for an additional representative. Direct Verify URLs remain valid for
checking a request or requesting access.

Default home requests use `recommended`: verified first, then `createdAt`
descending, then UUID descending for deterministic pagination. There is no
`publishedAt` column; `createdAt` retains existing listing-date semantics.
Explicit Latest (`newest`) stays purely chronological, and every alternative
sort keeps its existing semantics. Public status predicates/counts remain
published-only. “Upgrade/exposure” is this ranking benefit, with no billing,
payments, plans or separate paid Featured privilege.

## OTP security and privacy

Codes use cryptographic random generation, ten-minute expiry, single-use
consumption and HMAC-SHA256 storage with the auth secret. The hash binds challenge
ID, account ID, project ID, normalized contact email, requested role and code.
Resend rotates the challenge/hash, invalidating old codes. Five failed guesses
invalidate the code. Wrong-attempt counters commit even though the API returns
an error; row locks protect concurrent verification and approval.

Persistent atomic PostgreSQL quotas allow five sends per ten minutes per account,
recipient and client IP, with at least sixty seconds between sends for the same
account/project. Code confirmation allows twenty attempts per ten minutes per
account and IP, in addition to the five guesses per challenge. Upload issuance
allows forty per ten minutes/account. Keys are HMACs; raw recipients/IPs are not
stored in rate-limit keys. Quota failures stop delivery; existing daily auth
rate-limit pruning covers these buckets too. Delivery failures invalidate the
undelivered challenge and return a generic retryable error.

The API uses the same trusted-proxy single `X-Forwarded-For` contract documented
in [auth](auth.md); invalid/missing addresses share an unknown-IP bucket. Production
must prevent direct-origin header spoofing. Ownership endpoints reject foreign
browser origins/cross-site requests. Their RPC/REST responses are private/no-store;
workspace SSR is noindex and private/no-store. Public projections expose only
verification state, never claim contact emails, codes, IDs or approver identity.

The built-in Better Auth email OTP plugin covers account authentication/email
purposes, not project membership or its approval transaction. This separate
project challenge preserves existing GitHub + Magic Link sign-in. Email delivery
uses Resend and the shared React Email branding with server-only `RESEND_API_KEY`,
`RESEND_FROM_EMAIL` and trusted app URL. No new secret or service is required.

## Rollout and acceptance

Apply additive migration `20261024103730_project-ownership` using the normal
`vp run db:migrate` workflow on the intended target, then deploy matching API and
Web revisions. It creates claim/membership/upload tables, constraints/indexes and
extends allowed audit actions. It does not backfill owners or verified projects.
Retain configured email sender, trusted origins/proxy and temporary-media
lifecycle. Admins use the existing account permissions to review bootstrap claims.

Local tests use disposable `altstack_test_*` schemas. The focused API suite covers
OTP proof/guess limits/expiry/replay, account/project binding, approval eligibility,
claim races, cross-project denial, role/admin preservation, direct writes, media
ownership, stale edits, visibility/deletion, public projection and ranking. The
migration test starts from pre-R6 data and verifies preservation and constraints.
Email tests render actual HTML/plain text and replace only the Resend transport.
URL/UI tests exercise direct navigation, history, close, role/email/code and
pending approval. HTTP acceptance uses real Magic Link sessions and a test-only
loopback Resend sink; no production email switch is added.

Run `vp run --filter web test:ownership-http` for production-artifact HTTP checks;
use `--skip-build` only after a matching production build. `--preview` keeps the
disposable environment alive for browser QA and provides a private fixture file.
Staging acceptance still needs controlled-inbox delivery, inbox/spam rendering,
real storage upload/promotion, reviewer identity checks and cross-subdomain production cookies. No live
email or production deployment is implied by mocked local acceptance.

### Local validation — 2026-10-24

All final affected checks passed; these are focused runs, not the full suite:

- API: eight files / 170 tests across ownership, OpenAPI mapping, GitHub identity
  continuity, existing admin reads/metadata, bookmarks, Featured and licenses.
- Web: ten files / 162 tests covering Verify/Report routing, authentication
  handoff, expiry/resend/error recovery, history, public discovery/SEO, media,
  categories, bookmarks and Embed compatibility.
- Database: one additive-migration test, including existing-data preservation,
  repeat application, role/unique constraints and account-deletion cascades.
- Email: two files / six rendering, delivery and failure tests; the Resend
  transport is replaced by an in-process stub or loopback mailbox.
- `vp run typecheck`: all eight package checks passed. The production build
  (`test:scoped -- env NODE_ENV=production vp run -r build`) completed all nine
  tasks, including the repository lint task with no lint/type errors.
- Production-artifact HTTP acceptance passed real Magic Link sessions, delivered
  claim codes, single-use verification, independent approval, scoped immediate
  edits, private REST/SSR cache headers, safe public fields and home ordering.
- T3 collaborative browser: desktop dark dialog and keyboard role selection;
  auth return to the dialog; email/code focus; Escape focus restoration and Back
  reopening; 390px mobile layout without horizontal overflow; warm badge and
  hidden Verify after approval; My projects navigation and mobile editor save
  reflected immediately in the public catalogue. Verified first preceded the
  newer unverified fixture. The final disposable preview was stopped and its
  database schema cleaned up.

The controlled-inbox, storage-provider and deployed-domain checks above remain
rollout work. Local fixtures and mocked delivery do not establish those results.
