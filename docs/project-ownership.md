# Project verification and owner/maintainer editing

R6a and R6b are implemented together from local `dev` (`e98a4c1`). This is local
implementation and acceptance evidence, not production deployment. The user
confirmed the policy on 2026-10-24; it supersedes the old GitHub-only claim plan.

## Claim policy and lifecycle

Sign in with either existing method. Open `/$slug?dialog=verify`, connect GitHub
to check repository access, then enter a project contact email and choose Owner
or Maintainer. Both roles have identical access.
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

### GitHub evidence follow-up — 2026-10-24

Every new claim needs one GitHub account linked to the signed-in AltStack account.
The existing Better Auth verified-email linking policy remains: GitHub must verify
the same email as the AltStack account. The project contact email can still differ
and is confirmed separately by OTP. Linking/reconnecting returns to the same Verify
URL, including unrelated search parameters and hash. No additional repository
write scope is requested.

The server selects the linked account, asks Better Auth 1.7.12 to decrypt/refresh
its token, verifies `/user` against the stored GitHub user ID, and reads repository
permissions using that token. The catalogue `GITHUB_TOKEN` never proves claimant
authority. Repository IDs must match the stored listing identity when available.
Public repository visibility alone grants no project rights. See [GitHub metadata](https://docs.github.com/en/rest/repos/repos#get-a-repository)
and [Better Auth account linking](https://better-auth.com/docs/concepts/users-accounts#manually-linking-accounts).

- `admin`/`maintain`: strong repository-access evidence; OTP and independent
  approval remain mandatory. The identical AltStack roles do not assert legal
  ownership or organization ownership.
- `write`: the reviewer must record independent representation evidence,
  20–1000 characters, before approval.
- Confirmed `read`, `triage`, no access or mismatched account/repository identity:
  code issuance and approval are denied. Notes cannot override this result.
- Missing/revoked credentials, organization authorization restrictions, missing
  permission metadata, timeouts and provider errors stay **unverified**. A linked
  claimant may continue to OTP/manual review, but approval requires independent
  evidence notes. A disconnected claimant must connect GitHub first.

Checks run on opening/retrying the form, code issuance, and approval. Approval
always obtains fresh evidence. Account linkage and project identity are checked
under locks after network calls; decisions compare the challenge ID so an older
review cannot approve a replacement request. Initial GitHub user/repository IDs
also bind the OTP hash. Proof and review notes stay in private claim/audit data;
public listing projections expose neither.

Persistent ten-minute quotas allow 20 explicit checks/account and 40/IP, plus 30
approval checks/reviewer. Existing email/OTP limits remain. Calls time out after
eight seconds each; credentials and upstream error bodies never reach clients.
The dialog exposes connection, retry, denial and manual-review states, and the
review inbox shows evidence alongside independent verification notes.

Migration `20261024125455_claim-github-evidence` adds nullable JSON proof and
invents no evidence. Existing memberships keep their access. Legacy pending
claims can connect/refresh GitHub in the dialog and face the same approval check.

### Project editing

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

Both image grants and the publishable payload are validated before promoting
either image. S3 promotion runs outside database transactions. A short write
transaction then locks and rechecks publication, membership, revision, category
assignments and upload grants before consuming the grants and committing the
edit. Failed writes clean up only this attempt's promoted copies; replaced public
media is removed only after commit.

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

Apply additive migrations `20261024103730_project-ownership` and
`20261024125455_claim-github-evidence` using the normal
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

### R6 baseline validation — 2026-10-24 (`9796628`)

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

### GitHub follow-up validation — 2026-10-24

Focused final runs passed; the full suite was not run:

- API: 28 ownership tests and 68 OpenAPI mapping tests, including disconnected
  and read-only denial, identity mismatch, stale/cross-project access, concurrent
  account/repository changes, missing permission metadata, upstream errors,
  independent notes, private projections and existing OTP/approval protections.
- Web: 12 Verify/inbox tests plus the 81 affected bookmark/public-route tests.
  These check exact OAuth return URLs, blocked send buttons, rechecking access,
  unavailable evidence, note submission, email/code/history and existing actions.
- Auth: two account-token tests; DB: two additive-migration tests. Existing
  pending claims/members are preserved with null proof and no fabricated evidence.
- Production-artifact HTTP acceptance passed the real Magic Link and Better Auth
  OAuth linking/callback flows, encrypted stored-token resolution, claimant-token
  GitHub checking, OTP, approval, scoped editing, private headers and home order.
  Only GitHub and Resend transports are synthetic, under strict disposable-schema
  guards; no production test switch, real OAuth credentials or live email is used.
- T3 browser QA used separate synthetic signed-in accounts: disconnected claims
  could not send a code; maintain evidence enabled the email/code flow; return
  URLs retained search/hash; Escape restored focus and Back reopened the dialog.
  The dark 390px dialog had no horizontal overflow. The preview was stopped and
  its disposable database schema cleaned up.
- Production build completed nine tasks, including repository lint, and package
  type checks passed. Changed-file formatting/lint/type checks were also run.

Rollout must still confirm actual GitHub personal/organization permissions with
the deployed OAuth app, organization/SSO restrictions, reconnection and controlled
mail delivery. Synthetic permissions establish local handling, not those live
provider results.

### PR review fixes — 2026-10-25

Focused runs passed 35 ownership API tests, 68 OpenAPI compatibility tests,
12 Verify/inbox UI tests and three contact-email schema tests. New regressions
cover validation of both upload grants before promotion, category/project locks
remaining available during S3 calls, cleanup after partial storage failure, and
rechecking revision, membership, upload grants and publication before commit.
Email tests cover padded mixed-case input, invalid addresses and the normalized
254-character limit. Changed-file formatting, lint and type checks passed.
