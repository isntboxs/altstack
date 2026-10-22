# Sign in: GitHub + Magic Link

AltStack supports exactly two public sign-in methods: GitHub OAuth and email
Magic Link. Email/password signin, signup and username/password signin are
disabled on the server. The dialog and `/auth/sign-in` reuse `SignInForm`.
Authenticated users can submit and bookmark; neither method proves repository
ownership. R6 ownership/claims and notifications remain outside this change.

## Configuration and rollout

Use the existing server environment configuration. Never expose these through
`VITE_*`, Docker build args, client bundles, request logs, or analytics:

- `RESEND_API_KEY`: a Resend sending key, preferably restricted to the sender domain.
- `RESEND_FROM_EMAIL`: a plain email address on a Resend-verified sending domain,
  for example `sign-in@your-verified-domain.com`. The display name is AltStack.
- Keep `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, GitHub credentials, and exact
  `CORS_ORIGINS`. Client callbacks use configured `VITE_APP_URL`; arbitrary Host,
  forwarded host, or client origins never determine the email endpoint.
- Retain `BETTER_AUTH_COOKIE_DOMAIN` for production sibling subdomains; leave it
  unset for host-only localhost cookies. HTTPS keeps Secure/HttpOnly/SameSite=Lax.

The Resend settings are optional for builds and GitHub-only local development.
Email requests fail with a generic retryable 503 until both are configured.
No email URL, token, recipient or provider exception is logged by the sender.
Auth diagnostics contain only request method/path/status through the API logger;
reverse proxy access logs must omit query strings on `/api/auth/*` and avoid
recording request/response bodies, cookies, or redirect Location headers.
Disable click tracking for authentication emails on the sending domain in Resend
so authentication links are not rewritten through tracking infrastructure.

Apply the included database migration before starting the new API. It adds the
persistent `rate_limit` table used by Better Auth. Use the normal migration
workflow (`vp run db:migrate`) on the intended deployment database, then deploy
API and Web together. This implementation does not deploy or migrate production.
Existing users, roles, sessions, GitHub accounts, projects and bookmarks remain.

The API must only be reachable through the trusted reverse proxy in production.
The proxy must overwrite/sanitize `X-Forwarded-For` to a single client address;
Better Auth 1.7 rejects ambiguous forwarded chains and falls back to a shared
bucket when no trusted IP is available. Do not let external clients access an
unprotected origin and spoof that header. Multiple proxies require a deliberate
`advanced.ipAddress.trustedProxies` configuration for the actual proxy addresses.

## Link lifecycle and account semantics

Better Auth 1.7.6's supported `magicLink`/`magicLinkClient` plugins generate,
store, verify and atomically consume links. Tokens are hashed in database
verification storage, expire after ten minutes, and cannot be replayed. No custom
authentication token or session signing is implemented. Resend receives a rendered
React Email HTML and plain-text template with expiry and one-use instructions.

Requesting a link creates no user/session, and returns the same `{status:true}`
for existing and new addresses. Verification proves inbox ownership and creates a
verified user or signs in to the matching existing user. Existing verified users
retain ID, profile, admin role and GitHub associations. Magic Link users do not
receive a synthetic GitHub account. Only GitHub-verified matching email permits
implicit OAuth linking; `trustedProviders` no longer bypasses verification, and
linking different emails remains disabled. Users who change email should sign in
through their existing method rather than expect unrelated accounts to merge.

For a legacy **unverified** email record, Better Auth's documented takeover defense
revokes old sessions and removes unproven credential/OAuth links before marking
the inbox verified. It retains the user's ID/profile/role. This is intentional:
never mark old addresses verified in bulk or preserve unproven links by bypassing
the framework cleanup. Reconnect GitHub through its verified OAuth flow if needed.
Existing verified GitHub associations are unaffected.

Better Auth's database limiter allows five Magic Link requests per client IP per
ten minutes, including failures, and twenty verification requests per minute.
Unique database keys and conditional atomic increments enforce concurrent limits
and survive API restarts. Other auth endpoints keep Better Auth's established
limits. The UI disables requests while pending, offers a sixty-second resend
cooldown, and honors the server's `X-Retry-After` on 429. Delivery errors leave the
form editable and GitHub available. Quota is not reset by opening another dialog.

Success callbacks are absolute URLs under the configured frontend origin,
constructed from sanitized local `returnTo`. Invalid, expired or consumed links
return to `/auth/sign-in` with safe returnTo and a generic recovery message. Auth
responses are private/no-store and send `Referrer-Policy: no-referrer`. Successful
verification navigates through a fresh SSR request, preserving existing session
hydration, private route guards and SSR cookie refresh. Sign-out retains existing
router invalidation.

## Safe validation

Start the disposable local test database; all database QA uses README's wrapper:

```sh
vp install
vp run db:test:start
vp check
vp run typecheck
vp run --filter @altstack/db test:scoped -- vp run -r test
vp run --filter @altstack/db test:scoped -- env NODE_ENV=production vp run -r build
vp run --filter @altstack/db test:scoped -- vp test
vp run --filter web test:browser
vp run --filter web test:auth-http -- --skip-build
vp run --filter web test:bookmarks-http -- --skip-build
vp run --filter web test:admin-reports-http -- --skip-build
vp run --filter web test:featured-http -- --skip-build
```

HTTP suites create real sessions via the public Magic Link request/verify
endpoints. A test-only Bun preload intercepts Resend HTTP calls into a loopback
mailbox. It requires a disposable `altstack_test_<random>` schema; application
production code has no test delivery switch. Links stay in process memory and
are never printed or written to evidence files. There are no real email sends in
automated tests. Port settings come from the local frontend/backend env. Production HTTP QA needs
a production JSX build: keep `NODE_ENV=production` for the build command even
inside the disposable-schema wrapper, which otherwise sets `NODE_ENV=test`.
The HTTP suites' automatic builds already use production mode.

Feature acceptance `--preview` writes only synthetic emails, fixture IDs, and a
loopback `mailboxURL` to its private temporary `preview.json`. Request mail from
the UI, then open `mailboxURL/redeem?email=<synthetic-email>` using localhost to
verify that mock delivery without copying or displaying a token. This endpoint
exists only in the test runner when `--preview` is explicitly enabled.

Before production rollout, verify real delivery to a controlled inbox with the
verified sender, then check the link, inbox spam placement, one-use/expiry,
GitHub OAuth, cross-subdomain cookie acceptance, hard reload, private routes,
refresh and sign-out. Live Resend delivery and real GitHub OAuth completion are
separate staging checks and are not claimed by mocked HTTP tests.

## References

- [Better Auth Magic Link](https://better-auth.com/docs/plugins/magic-link)
- [Account linking](https://better-auth.com/docs/concepts/users-accounts#account-linking)
- [Rate limiting](https://better-auth.com/docs/concepts/rate-limit)
- [Resend Node.js SDK and verified domain prerequisites](https://resend.com/docs/send-with-nodejs)
- [React Email](https://react.email/docs/introduction)

## Verification — 2026-10-22

Validated locally against baseline `8ffc261` in the prepared auth worktree:

- `vp install`, `vp check`, and all eight `vp run typecheck` targets passed.
- Disposable-schema `vp run -r test` passed. The root `vp test` run passed
  1,243 tests with one existing skipped test. Focused auth coverage includes 36
  auth tests, 19 shared form/route tests, SSR middleware and CORS regressions.
- Production monorepo builds passed; the final auth layout was rebuilt in
  production mode. Existing chunk-size/dependency directive warnings remain.
- The Vitest Chromium browser suite passed all 15 tests after installing the
  pinned Playwright browser through `vp run test:browser:install`.
- Auth, Bookmarks, admin Reports, and Featured Projects HTTP acceptance passed
  with real HTTP Magic Link sessions, mocked Resend delivery and disposable DB
  schemas. Auth acceptance covers password rejection, expiry/replay, admin/GitHub
  account preservation, legacy unverified account cleanup, concurrent rate
  limits, local callbacks, private-route SSR, session refresh and sign-out.
- Desktop/mobile browser QA passed for both dialog and standalone route:
  validation, request/inbox state, verification, preserved returnTo, hard reload,
  UI sign-out and invalid-link recovery. No horizontal overflow or browser errors.
  T3 Preview navigation worked but snapshots timed out twice; QA continued with
  the repository's installed Playwright browser.

No live Resend email was sent, no real GitHub OAuth consent/exchange was completed,
and no deployment or production migration was performed. The local Resend key
was present; a verified `RESEND_FROM_EMAIL` still needs operator configuration.
Real mailbox delivery and cross-subdomain production browser cookies remain
staging rollout checks.
