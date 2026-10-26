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
is derived from active membership existence, so deleting the last representative
removes the badge/ranking benefit. When an admin changes a listing to a different GitHub
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

Default home requests use `recommended`: verified first, then GitHub stars
descending (missing stars count as zero), then UUID descending for deterministic
pagination. Category listings default to `most-stars`.
Explicit Latest (`newest`) stays purely chronological, and every alternative
sort keeps its existing semantics. Public status predicates/counts remain
published-only. “Upgrade/exposure” is this ranking benefit, with no billing,
payments, plans or separate paid Featured privilege.

## Member management follow-up — 2026-10-26

`/managed` now lists all of the account's approved memberships, including hidden
listings, so an account can leave a project even while editing is unavailable.
Published listings retain their editor; **Members** opens
`/managed/$id/members`. The page identifies the project and shows representative
names, project roles and account availability, without login/contact emails or
GitHub proof. Admins reach the same page from the project editor or user detail.
Lists use bounded pagination; the caller's own membership is always returned for
self-service, even when it is on another page.

Owner and Maintainer remain equal for editing and reviewing claims. Neither can
change their own label or remove/change another representative. Only a current
AltStack admin can change another account's project role or revoke its membership.
An admin's own membership uses the same rules: another admin changes their project
label; **Leave project** removes their own access. Account administration and
project representation are separate. No direct add/invite bypasses OTP, fresh
GitHub evidence or independent approval. Existing global owner/maintainer labels
remain informational; a project role change or removal does not rewrite them.

Any representative may explicitly leave, including the last representative.
Admins may also revoke the last membership. This catalogue verification does not
assert legal ownership and must not trap someone in an unwanted affiliation.
The last active representative's departure removes the public verified badge and
ranking advantage. Pending claims remain pending, but with no active members a
different admin must review them again under the bootstrap policy. Returning after
leave/revocation requires a fresh email challenge and independent approval; the
previous approved claim and unused upload grants are removed atomically. Audit
history remains. Bans retain membership records but exclude the account from
active representation, editing and review; unban restores those retained rights.

Every mutation compares the membership's PostgreSQL row revision, including
removal and reapproval races. The project row lock serializes role changes,
revocation, leaving, approvals, uploads and final edits. Reviewers and claimants
are rechecked after GitHub network work; edits recheck membership after media
promotion and clean up failed promoted copies. Account row locks coordinate bans
and account-role changes with project writes. Revocation removes membership-based
edit/upload/delete-upload/review rights;
another project's membership grants no rights. Separate global admin moderation
and bootstrap permissions still follow their existing policies. Already issued S3
URLs expire after ten minutes; they can only write an
orphan temporary object after revocation because the deleted grant prevents
promotion or consumption. Existing temporary-object lifecycle cleanup applies.

Membership screens confirm destructive actions and explain last-representative
behavior. Successful changes invalidate private membership/inbox and public
catalogue queries; leaving discards cached editor data and returns to My projects.
Stale changes show a conflict and require refreshing. Private RPC/REST and HTML
responses remain private/no-store and private pages remain noindex.

The additive migration `20261026115414_member-user-management` only expands the
audit action constraint. It retains all existing account, project, membership,
claim and session data. Apply it before matching application revisions on an
intended target; this implementation does not imply deployment.

### Local follow-up validation

Focused validation passed; the full repository test suite was not run:

- API: five files / 157 tests (`admin-user`, `ownership`, `openapi-mapping`,
  `bookmark`, `category-public`). Coverage includes real Better Auth sessions,
  REST/RPC contracts, self-escalation and cross-project denial, stale revisions,
  reciprocal admin demotions/bans, transactional audit rollback, reapproval,
  reviewer revocation during GitHub checks and edit revocation during promotion.
  The public-mention test's stale expected payload was updated to include the
  already-supported `verified` field.
- Auth: three files / 43 tests (`cookies`, `magic-link-postgres`,
  `github-access-token`), including rejection and cookie expiry for a surviving
  banned session. Provider and email transports use synthetic fixtures.
- Web: four files / 39 distinct tests over focused runs (`member-admin-users-route`,
  `project-report-route`, `admin-reports-route`, `auth-middleware`). New journeys
  cover route guards, URL search/filter state, account confirmations, ban reason,
  error recovery, member role/revoke and self-leave navigation.
- Server: eight CORS/cache tests. Database: three migration tests, including
  preserving existing accounts/sessions/memberships/audits and accepting all new
  audit actions while rejecting unknown actions. PostgreSQL uses disposable
  `altstack_test_*` schemas; development/production data is not reset.
- Changed-file formatting and lint passed. Type checks passed for API, Auth,
  DB, Shared, Server and Web. Direct Vite+ package builds passed for Shared,
  Auth, API and Server, and the Web production build passed. Dependency bundler
  warnings about module-level directives remain; no production rollout or live
  provider/storage acceptance is claimed.

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
undelivered challenge, reset its resend cooldown and return a generic retryable
error. Failed attempts still count toward account, recipient and valid-IP quotas.

The API uses the trusted-proxy single `X-Forwarded-For` contract documented in
[auth](auth.md#dokploy-client-ip-configuration). Missing, invalid or chained
addresses do not create an IP bucket or use an alternate header; authenticated
account limits and recipient limits still apply. Unrelated claimants never share
an unknown-IP bucket. Production must supply one valid client address and prevent
direct-origin header spoofing. Ownership endpoints reject foreign
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
