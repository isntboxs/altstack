# Report / suggest correction

Published project pages expose **Report** on desktop and in the compact/mobile
**More** menu. `/<slug>?dialog=report` opens the dialog, including on direct entry
and reload. The existing `dialog=embed` discriminator remains mutually exclusive.
Opening/closing preserves unrelated search parameters, the hash, scroll and
loaded project data. Cancel, Close, Escape and outside click remove the dialog
parameter; browser back/forward follows URL state and focus returns to Report or
More. Dialog navigation does not refetch the project or show a page skeleton.

Guests enter a valid email (maximum 254 characters). Signed-in users and admins
only edit Type and Message; the server uses the current session's user ID/email,
ignoring a supplied email. If the session expires, refresh the session or reload
to enter a guest contact before retrying.
Type is required: **Broken link**, **Wrong category**, **Outdated**, **Other**.
Message is trimmed and limited to 2,000 characters, optional except for Other,
which requires nonblank text. Shared schemas enforce these rules on both sides.

`report.create({ params: { id }, body: { type, message?, email? } })` and
`POST /api/reference/projects/{id}/reports` persist to `project_reports`. Success
returns only `{ received: true }`, after the transaction commits. A project row
share lock protects published visibility until commit; missing/draft/rejected/
removed targets receive the same NOT_FOUND response, including for admins.
Persistence errors return a generic server error. The form preserves entries on
failure, prevents repeat sends while pending, never retries automatically, and
clears/closes only after successful persistence. A lost response can still mean a
committed report; a later manual retry can create another report.

Intake has no list/read/admin endpoint, no external email delivery, and does not
change projects automatically. Report contact, message and identity stay outside
public project data and projections. Triage currently requires authorized
database access. Deleting a project cascades its
reports; deleting an account clears the user FK but retains its submitted contact.
No additional retention job is introduced in this focused intake change.

## Abuse protection

Reports reuse the existing oRPC Upstash adapter/Redis client, separate from the
submission quota: **5 validated attempts per 10 minutes** per authenticated
account (including admins), or per normalized guest email hash. Guests also share
an environment-wide **50 attempts per 10 minutes** cap. Keys use
`altstack:<NODE_ENV>:report:identity` and `altstack:<NODE_ENV>:report:guest`.
Raw emails and IP addresses are not used in Redis keys. Email hashes are not a
promise of anonymization. Guest email is unverified; the shared anonymous cap
bounds intake when addresses are rotated and can temporarily limit other guests.
No forwarding headers are trusted and no IP tracking/CAPTCHA is introduced.
Use edge/WAF protection for network-level floods if needed.

Invalid payloads/contact do not consume quota; valid attempts consume quota even
when target lookup or persistence fails. Redis errors fail closed, with the
existing five-second request deadline and no local fallback. HTTP quota errors
include 429, quota data, RateLimit headers and Retry-After through existing CORS.
The UI displays the quota failure and waits for an explicit retry.

## Rollout and verification

Apply additive migration `20261021082531_project-reports` with `vp run db:migrate`
before rolling out the API, then the web build. It creates only the intake table,
constraints, foreign keys and indexes; existing project/bookmark data is preserved.
Use the existing server-only Upstash credentials (dedicated development Redis
locally); no new secret, service or client environment variable is required.
No deployment or migration to shared application data is performed by tests.

Run database-backed checks only through the disposable-schema wrapper:

```sh
vp install
vp check
vp run typecheck
vp run --filter @altstack/db test:scoped -- vp test run
vp run --filter @altstack/db test:scoped -- vp run -r test
vp run -r build
```

Focused tests live in shared `tests/report.test.ts`, API `tests/report.test.ts`
(real migrated disposable schemas, mocked Redis), web `tests/project-report*.test.tsx`,
with browser QA of the real application through T3 preview. They cover contact/session
spoofing, conditional validation, private persistence and errors, nonpublic targets,
quota enforcement, both forms, and URL/focus/keyboard lifecycle. Existing Embed and
Bookmarks tests remain regression coverage.
