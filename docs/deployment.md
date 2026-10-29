# Deployment and operations

These are procedures for an instance you operate. All names, URLs, and versions
shown as examples must be replaced with your own choices. Keep credentials and
deployment evidence in private operator storage.

## Services and builds

Deploy the web SSR service and Bun API together with PostgreSQL, Redis REST,
S3-compatible assets, GitHub OAuth, and optional email delivery. Docker Compose
in this repository provides local databases only; it is not a full production
deployment. Scheduled jobs run separately from the API request process.

Build both images from the repository root so workspace dependencies resolve:

```sh
docker build -f apps/server/Dockerfile -t example/altstack-server:example-release .
docker build -f apps/web/Dockerfile -t example/altstack-web:example-release \
  --build-arg VITE_APP_NAME=AltStack \
  --build-arg VITE_APP_URL=https://app.example.com \
  --build-arg VITE_SERVER_URL=https://api.example.com \
  --build-arg VITE_S3_PUBLIC_URL=https://cdn.example.com .
```

The API image runs `apps/server/dist/index.mjs` on port 3009. The web image runs
`.output/server/index.mjs` on port 3000. Set server-only runtime configuration
through the deployment secret store, using the [configuration section](development.md#configuration).
Public `VITE_*` changes require rebuilding web. Images do not run migrations at
startup. Use immutable image digests or commit tags for reproducible deployments;
the example tag above is illustrative.

The [publish workflow](../.github/workflows/publish-docker.yml) runs on `v*` tag
pushes or manual dispatch. For your fork, configure Actions secret
`DOCKERHUB_TOKEN`, repository variable `DOCKERHUB_USERNAME`, and all four public
`VITE_*` variables. It publishes `altstack-server` and `altstack-web` to that
namespace with release/commit tags. Publishing images is separate from deploying
them; the workflow does not configure your running services or database.

## Migration and rollout

1. Select matching API/web revisions and review pending migrations/configuration.
   Verify a recent recoverable backup before a shared database change.
2. From the matching checkout or a migration environment with Vite+ tooling and
   your privately configured `DATABASE_URL`, check [reserved project slugs](#reserved-project-slugs)
   on that target before migrating:

   ```sh
   vp run db:check-project-slugs
   vp run db:migrate
   vp run --filter @altstack/db db:validate-audit-actions
   ```

   The slug check is read-only and also runs automatically before `db:migrate`;
   a collision stops migration with a nonzero exit code. The final command
   validates the expanded audit-action constraint after the
   migration transaction commits, avoiding a prolonged exclusive lock. It is safe
   to repeat. Do not replace migrations with `db:push`, reset the journal, or
   backfill project membership from submission history.

3. Deploy the API and web images from the selected revision. Configure exact
   origins, HTTPS cookie scope, storage CORS/lifecycle, and a trusted reverse
   proxy. Ensure the proxy forwards `QUERY` requests and normalizes client IP
   headers; keep the API origin protected from direct header spoofing.
4. Verify sign-in, a private-route hard reload, session refresh, sign-out, public
   catalogue/detail, and anonymous/non-admin access boundaries. Exercise
   submit → reject → correct/resubmit → publish using synthetic records.
5. Configure and verify the workers below, including an actual scheduled run.
   Then check project access claims, representative edits/uploads, admin role/ban
   safeguards, badges, and no-store behavior for the release's affected features.

Record revision, migration outcome, aggregate results, and untested integrations
privately. A successful build or source merge alone does not establish deployment
or live provider acceptance. For application rollback, use the previous matching
image pair after checking schema compatibility; keep additive migrations unless
a separate recovery procedure requires otherwise.

### Reserved project slugs

The static `/collections` route takes precedence over a legacy project at
`/collections`. New-write validation does not repair existing project rows. Run
`vp run db:check-project-slugs` with the intended instance's `DATABASE_URL`; a
local result does not certify another environment. It checks every project
status against the shared reserved-route list, including `collections`, without
changing records. It also permits a fresh database before its first migration.

If the check reports collisions, keep the current release running and rename
each affected project through admin project editing to an unused, non-reserved
slug, such as `collections-project` if available. Preserve project IDs, statuses,
and memberships. Record the old/new URLs privately and update links you control;
slug changes do not create redirects, and `/collections` belongs to the directory.
Re-run the check and proceed only when it passes. Pause project writers during
the final check and rollout so an older API cannot introduce another collision.
After deploying the matching revisions, confirm the renamed project URL and
project sitemap use the new slug, and `/collections` opens the directory.

## Scheduled workers

Run these in the **server** image with its private runtime configuration and
working directory `/app`. Use your platform's scheduler; for example, a Dokploy
application job can execute the command in the running server container.

| Worker         | Command                                                  | Example schedule                       |
| -------------- | -------------------------------------------------------- | -------------------------------------- |
| GitHub refresh | `bun run apps/server/dist/jobs/github-refresh.mjs`       | `0 2 * * *`, explicitly `Asia/Jakarta` |
| Review email   | `bun run apps/server/dist/jobs/review-notifications.mjs` | `* * * * *`                            |

The daily clock time is an example; GitHub history date buckets use Asia/Jakarta
in code. Set the scheduler timezone explicitly and verify the next execution.
No migration, build, API startup, or dashboard enables a scheduler automatically.

**GitHub refresh** needs `GITHUB_TOKEN`. Run once manually to inspect the initial
metadata sync before enabling the schedule. It refreshes published projects,
retains earlier snapshots after failures, and uses a database advisory lock to
skip overlapping batches. Repository failures are counted; GitHub rate limiting
stops the batch. Failure/rate limiting gives a nonzero exit code; an overlap skip
is successful but did no refresh work. The job also prunes old star history and
inactive auth rate-limit buckets; monitor both cleanup and refresh results.

**Review delivery** needs `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and a trusted
`EMAIL_APP_URL` present in `CORS_ORIGINS`. It processes up to 25 due decisions per
run using leases and worker-safe row selection. Recipient, sender, and body are
frozen before the first provider attempt; retries retain the same identity.
There are at most eight attempts, and automatic sending stops 23 hours after the
first attempt. Missing configuration leaves work pending and exits nonzero.
Queued decisions with no first attempt can wait longer.

Provider acceptance is recorded as sent, not confirmed inbox delivery. Delivery
webhooks and automatic outbox retention are not implemented. After failure or an
uncertain receipt, reconcile provider state privately before a manual resend;
resetting attempts or identities can duplicate messages. Later empty runs do not
prove earlier failed rows recovered.

## Monitoring and storage

Monitor service health, scheduler exits, successful snapshot age, due/oldest
pending review notifications, failed/cancelled counts, backup freshness, and
storage growth. The admin operations page exposes aggregate snapshots, not a job
run ledger or backup monitoring system. Alerting is an operator responsibility.

Keep auth query strings, cookies, redirect locations, email bodies, claim proof,
and provider responses out of application/proxy logs. Record only the diagnostic
fields needed for investigation. Use synthetic accounts for acceptance evidence.

Configure lifecycle expiration for temporary upload objects (`tmp/*`), aligned
with the 24-hour upload-grant window. Incomplete multipart upload cleanup is a
separate rule and does not expire completed temporary objects. Preserve promoted
project media. Keep application asset access separate from database backup access.

## Backups and isolated restore

Choose backup frequency, retention, acceptable data-loss window, and recovery-time
objectives for your instance. A daily backup with thirty retained objects is an
example policy, not an observed repository guarantee. Keep backups encrypted and
off-host in private storage with narrowly scoped credentials. Verify disabled
public access and monitor actual backup completion/freshness.

An archive existing is insufficient: regularly restore a completed off-host
backup into a new PostgreSQL instance with a compatible major version/extensions.

1. Download the archive privately. Verify checksum, nonzero size, and compression
   integrity. Inspect its format: a gzip file may contain a custom `PGDMP` archive
   rather than SQL. Use `pg_restore` for a custom archive and `psql` for plain SQL.
2. Create a separate disposable database/container with no published ports or
   network access, no production volume mounts, and no web/API/worker processes.
   Keep dump files and diagnostics private. Copied outbox/auth data must not
   trigger email or external integrations.
3. Confirm the target identity is empty and isolated. Restore a custom archive
   with `pg_restore --exit-on-error --single-transaction --no-owner --no-acl`,
   or plain SQL with `psql -X --set=ON_ERROR_STOP=1 --single-transaction`, using
   only the isolated target.
4. Compare schema, migration ledger, required extensions, table/row inventory,
   constraints, and indexes to the backup inventory. Run suitable PostgreSQL
   integrity checks. Account for observation timestamps when comparing a live
   source that may have changed since the dump.
5. Record aggregate outcomes and restore duration privately, then remove only
   the drill resources and temporary dump/log copies. A local restore time is
   not a complete incident recovery-time measurement.

## Incident recovery

Stop writers and scheduled jobs, preserve the existing database/evidence, and
select a known-good backup predating the incident. Restore into a fresh isolated
target and complete the checks above before planning cutover. Recover matching
application images and private configuration separately; a database dump does not
back up object assets, provider settings, or secrets.

Review restored sessions and pending/frozen email decisions before enabling any
worker. Avoid blindly clearing or replaying outbox identities. Obtain the
operator's approval for the concrete cutover, validate auth/public/admin journeys,
then deliberately resume jobs. Verify a new off-host backup after recovery and
compare actual data loss and recovery duration to the instance's objectives.
