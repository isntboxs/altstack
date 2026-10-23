# Submission review emails

Implemented in this worktree on 2026-10-23, on top of `c3e0980`. This is local
implementation/verification evidence, not a deployment or live-delivery claim.

## Behavior and ownership

An actual status transition into Published or Rejected queues a decision email
for the original account stored in `projects.submitter_id`. The account must
exist and have a valid email. Mutation-supplied recipient fields are ignored;
admin-created records without a submitter do not generate mail. Draft/Removed,
ordinary edits, corrected rejection wording and unchanged/repeated saves do not
generate new notifications. A later resubmission/review has a new audit event and
can notify again. Existing moderation permissions, validation, optimistic
concurrency, intake limits, account linking and visibility policies are preserved.
R6 ownership/maintainer permissions remain deferred.

Published mail names the project and links to the public `/$slug` page and private
`/submission`. Rejected mail includes the decision's feedback as escaped text and
links to the existing `/submission` → **Edit & Resubmit** journey. Sign-in returns
to `/submission` using the existing local `returnTo` guard. The user signs in with
the original submitting account; links grant no additional access. There is no
new inbox, push delivery, report mail or marketing subscription.

## Template and server boundaries

All React Email components live in `packages/ui/src/emails`: `layout`,
`primitives`, `magic-link`, `submission-published`, and `submission-rejected`.
Import the explicit `@altstack/ui/emails/<name>` subpaths. They have no DB, env,
auth-server or Resend imports and are separate from interactive shadcn components.
The private UI workspace retains its source exports; its scoped build compiles
these email entrypoints without rewriting existing UI component exports.

`@react-email/render` is declared directly by server consumers (auth/API) and
the UI preview/test tools. Magic Link sending stays in auth; moderation/outbox
and delivery stay in API; the scheduled CLI lives in server. Removing the old
auth `magic-link-template` export required updating its only consumer. No other
React Email templates were found in the repository audit.

Design follows [the bundled brand guide](brand/README.md) and the
[approved brandkit](https://github.com/isntboxs/altstack-brand): lowercase Inter
wordmark, Offset Blocks, black/white, neutral surfaces and restrained spacing.
Tables, pixel styles and email primitives replace interactive website components.
Inter falls back to Arial/Helvetica; no web font download is required. The
transparent PNG is derived from the bundled SVG master, served by Web at
`/brand/altstack-email-symbol.png`. The wordmark, outcome, feedback and CTA remain
readable when images are blocked. The CTA is black/white (21:1); body copy
`#525252` on white is approximately 7.8:1. Every variant renders HTML and text;
feedback line breaks are explicit `<br>` elements and remain in plain text.

## Durable delivery and its limits

Migration `20261023074640_submission-review-notifications` adds the private
`submission_review_notifications` table. There is **no historical backfill**.
The committed `project_status_changed` audit UUID is its primary/FK identity.
Project update, audit and outbox insert commit together; failure rolls all back.
The worker reads committed rows only; no provider call happens in moderation.

Each run handles at most 25 due rows sequentially. `FOR UPDATE SKIP LOCKED` and
a committed five-minute lease isolate concurrent workers. A lease token fences
receipt updates. Before the first provider call, the worker freezes recipient,
sender, subject, HTML and text durably. Retries keep that payload and the same
`submission-review/<audit UUID>` Resend key across restarts/deployments; content,
template or sender changes do not change an in-flight request. A fifteen-second
abort signal bounds the provider request. A lost receipt is retried after lease
expiry using the same provider key.

There are at most eight claimed delivery attempts, with retry delays of
1, 5, 15, 30, 60, 120 and 240 minutes. Automatic sends stop 23 hours after the
first attempt, including after a long outage. Resend documents a
[24-hour idempotency window](https://resend.com/docs/dashboard/emails/idempotency-keys).
These are bounded retries with provider deduplication, **not an exactly-once or
inbox-delivery guarantee**. An accepted request can still bounce; this slice
does not consume delivery webhooks. A crash at the attempt cap can leave a
provider-accepted event recorded as failed/uncertain.

Missing/invalid configuration leaves work pending without consuming attempts;
the CLI exits nonzero. Events with no first attempt can wait beyond 23 hours.
All provider failures, including permanent rejections, use the bounded retry
policy and fixed error codes. A changed recipient address cancels an already
frozen retry. Account/project/audit deletion cascades its outbox records. Email
already in flight cannot be recalled. Decisions are immutable snapshots: queued
mail can describe an earlier decision after later moderation/resubmission; the
linked private page is authoritative for the current state.

The outbox contains private feedback and frozen recipient/body data. It has no
public API, relation projection or shared cache entry. Logs contain aggregate
counts and fixed error codes only, with no addresses, bodies, auth URLs, or raw
provider/DB errors. There is no automatic outbox retention/purge policy yet;
restrict database and backup access as for auth and review audit data.

## Rollout and operations

1. Apply the additive migration through the normal release process before the
   new API/job. Do not reset application data. A database rollback is unnecessary
   for an application rollback; old code can leave this additive table unused.
2. Deploy Web with the new PNG and deploy the API/job. Reuse server-only
   `RESEND_API_KEY` and `RESEND_FROM_EMAIL` on a verified Resend sending domain.
   Set `EMAIL_APP_URL` to the canonical Web **origin**, also explicitly listed
   in `CORS_ORIGINS`. HTTPS is required in production; HTTP loopback is permitted
   for local development. Do not use paths, query parameters or credentials.
   Magic Link uses this origin for brand assets when set, otherwise the first
   trusted CORS origin. Existing Magic Link expiry/one-use behavior is unchanged.
3. Configure the existing deployment scheduler to execute every minute from
   `/app` in the server container:

   ```sh
   bun run apps/server/dist/jobs/review-notifications.mjs
   ```

   Cron expression: `* * * * *`. The built server image contains the entrypoint;
   it is independent from the daily GitHub job. No public cron endpoint or
   in-process timer is added. This work does not enable a live schedule.

4. Monitor scheduler exit status plus pending backlog age and failed/cancelled
   counts in the private DB. Example aggregate-only query:

   ```sql
   SELECT status, count(*), min(created_at) AS oldest
   FROM submission_review_notifications GROUP BY status;
   ```

   Exit 1 indicates a skipped/misconfigured run, retry, terminal failure or job
   exception. A later empty run is not proof that earlier failed rows recovered.
   After an outage, let the worker recover unexpired leases automatically.

5. For a failed/uncertain row, use restricted operator access to reconcile the
   audit identity with Resend before any manual resend. There is deliberately no
   automatic replay/reset button. Do not clear `first_attempt_at`, change a frozen
   payload, or reuse a key beyond its window as an assumed safe replay. Manual
   redelivery can duplicate an accepted email and needs an explicit decision.
6. Record staging acceptance using operator-owned test accounts: publish and
   reject → email → sign-in → private feedback → Edit & Resubmit → re-review.
   Check Gmail/Outlook/Apple Mail and bounce handling separately. No real email,
   production migration, deployment or real-provider QA ran for this change.

## Local verification

Use the root README's disposable-schema wrapper on local Docker `altstack_test`.
New tests cover committed/deduplicated events, rollback and uncommitted isolation,
concurrent moderation/workers, resubmission, original-recipient selection,
no-submitter skips, privacy/escaping, provider failures, frozen retry payloads,
lost receipts, caps/deadlines, origin validation and additive migration reruns.
The CLI tests check aggregate-only logging, exit status and pool cleanup.

Fresh results for this change are recorded in [preview/QA notes](email-previews/README.md).
Older counts in auth, brand, resubmission and roadmap documents describe their
original runs; they are not additional fresh checks of this worktree.
