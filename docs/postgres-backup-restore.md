# PostgreSQL backup and isolated restore

## Status and agreed policy

This work started on **2026-10-27 WIB** (2026-10-26 UTC). The operator selected:

- A new, dedicated private Cloudflare R2 bucket: `altstack-db-backups`.
- One full PostgreSQL backup daily at **03:00 Asia/Jakarta**.
- Retain the latest **30 backup objects**. With uninterrupted daily
  backups this is about 30 days; manual backups also consume retention slots.
- Use Dokploy's built-in database backup, scheduling and retention.
- Restore a downloaded off-host backup to a separate PostgreSQL instance with
  no application processes, workers, public ports or network connectivity.

**Automatic backup is enabled and an isolated production restore passed.**
The [safe execution evidence](production-backup-restore-2026-10-27.json) records
identifiers, timestamps, checksums and aggregate results without database rows or
credentials. Production records, migrations and application configuration were
not changed.

Authenticated inspection found Dokploy v0.30.8 with no backup configurations or
S3 destinations. The production PostgreSQL service is running PostgreSQL 18.6
(`postgres:18`). Read-only SQL at `2026-10-26T17:38:39Z` found 22 tables across
`public` and `drizzle`, approximately 10 MB, no invalid indexes and no unvalidated
constraints. A later repeatable-read observation counted 571 rows including the
migration ledger; private comparison fingerprints remain outside the repository.

The new bucket was created at `2026-10-26T17:36:35Z` in APAC with Standard
storage. Cloudflare's control-plane API confirms its `r2.dev` access is disabled
and it has no custom domains. Its only initial lifecycle rule aborts incomplete
multipart uploads after seven days; it does not expire database backups.
The Dokploy scheduler container explicitly has `TZ=Asia/Jakarta`. Backup
`BpR6y4_yxQCJ6VA5V0YGT` is now enabled at `0 3 * * *` with
`keepLatestCount=30`, using destination `vM4ynZue9qHsNXCJe1f3P` and object prefix
`altstack-database-production-iq6vpg/production/`. The dedicated backup token
passed write/read/list/delete tests and received `AccessDenied` when attempting
to list the asset bucket.

Initial backup `hmvHIy3iVpDqE5bijEPwz` completed on 2026-10-27 at approximately
**00:48 WIB**. The 38,381-byte off-host object was independently downloaded from
R2, checked for gzip integrity and identified as a custom PostgreSQL archive.
Its SHA-256 is recorded in the evidence file.

The downloaded backup restored successfully into a new PostgreSQL 18.6 container
with no network, published ports, host mounts or application processes. All
**22 tables and 571 rows**, including **27 migration ledger entries**, matched
private read-only production fingerprints. Before/after source observations
were stable across the backup. No private fingerprint values are published.
Schema DDL was identical after standard dump normalization except equivalent
regrouping of one email check: `((A AND B) AND C)` became `(A AND B AND C)`.
There were **0 invalid indexes**, **0 unvalidated constraints** and 188 catalog
constraints; `pg_amcheck --heapallindexed --parent-check --rootdescend` passed.
Import took 0.295 seconds and the local drill took 13.803 seconds, excluding
download and a complete incident cutover; this is not a production recovery RTO.

A separate temporary backup configuration automatically ran at
**00:49:56 WIB**, using the same database, destination and retention count.
In its isolated test prefix, 35 synthetic old canaries plus the generated backup
were pruned to exactly 30 objects: the oldest six disappeared and the newest
29 canaries plus the real backup remained. The temporary configuration and all
test objects were then removed; the primary backup remained intact. This proves
scheduler execution and count pruning without filling the recovery prefix with
synthetic files. The first ordinary **03:00 WIB** daily run is still pending;
its next time is computed as **2026-10-27 03:00 WIB**, not an observed execution.

Read-only follow-up also found no configured Dokploy notification destinations.
The existing application storage credential can list the new backup bucket;
separating buckets does not retroactively narrow an existing account-wide token.
This credential scope is an explicit hardening gap, distinct from the verified
disabled public access. Do not change a potentially shared application token or
redeploy the application as an undocumented side effect of a restore drill.

The [2026-10-24 production record](production-verification-v0.4.0.md#open-outcomes-owners-and-recovery)
reported no configured backup and no alternative backup/restore known to the
operator. That is historical evidence; verify the live service before changing it.
The asset bucket and its public CDN are unsuitable for database backups.

The daily policy targets up to approximately **24 hours of data loss** after the
last successful backup. Failures can make this window longer. It provides no
point-in-time recovery or immutable backup storage. No complete incident
recovery-time objective has been established by the local database drill.

## Configure and verify

1. Read the live Dokploy version, project/environment, PostgreSQL identity and
   image, existing backups, destinations and job history. Record identifiers
   and safe configuration only. Never print environment values or credentials.
2. Create or reuse only the selected private backup bucket in the correct R2
   account. Verify public development access is disabled and there are no
   public custom domains. Do not enable CORS or attach the asset CDN. Use a
   separate bucket-scoped Object Read & Write S3 credential for Dokploy. Inspect
   and record the existing application credential's scope separately; do not
   broaden it for backups. Control-plane access is needed to verify bucket
   privacy; object access alone is insufficient.
3. Create the Dokploy S3 destination and test it. Scope the backup to the
   confirmed production database with its own object prefix. Configure
   `keepLatestCount=30` only after checking installed-version behavior and
   confirming the prefix contains no unrelated objects.
4. Establish the scheduler process timezone. A cron field alone does not
   establish 03:00 WIB. If the process uses UTC, `0 20 * * *` corresponds to
   03:00 WIB the following day; if it uses Asia/Jakarta, use `0 3 * * *`.
   Verify the next run time and capture the first automatic execution.
5. Trigger the initial backup. Verify the job finishes successfully, then
   independently list and download the resulting object from R2. Record its
   timestamp, nonzero size and SHA-256, plus the download result. Never make a
   public URL, publish a dump or store credentials/dumps in this repository.
6. Check the artifact format rather than relying on the `.sql.gz` suffix.
   Dokploy versions can gzip a PostgreSQL custom archive. Check gzip integrity
   and inspect the decompressed header; `PGDMP` requires `pg_restore`, not
   feeding the archive to `psql`.

## Isolated restore drill

Use the latest completed off-host object, downloaded using the dedicated backup
credential. Keep it and command stderr in a mode-0700 private directory with
mode-0600 files. Disable shell tracing and keep database payloads out of logs.

Run **only PostgreSQL**, using a compatible major version and required
extensions from the inspected production instance. Create a new uniquely named
container with `--network none`, no published ports and a fresh disposable data
volume or tmpfs. Do not reuse the development/test Compose database, mount a
production volume, pass application environment, or start API/Web containers.
Docker exec through its Unix socket is sufficient for local restore and checks.
These controls prevent copied outbox rows or jobs from sending email, making
GitHub/storage requests, or connecting to production.

1. Confirm the empty target database identity and container isolation before
   loading data. Never run a restore or `--clean` against a production URL.
2. For a custom archive, use `pg_restore --exit-on-error --single-transaction
   --no-owner --no-acl` against the new database. For verified plain SQL, use
   `psql -X --set=ON_ERROR_STOP=1 --single-transaction`. Capture output privately;
   abort on any restore error. A dump existing or a successful download is not
   proof that these steps passed.
3. Compare restored schemas, tables, migration ledger and row totals to the
   backup inventory and, where accessible, a read-only production snapshot.
   Record the source observation time: a changing live database is not the
   same snapshot as the dump. Do not silently treat concurrent differences as
   equal, or publish row values, user identifiers, tokens or email addresses.
4. Verify expected indexes are valid, inspect unvalidated constraints, check
   foreign-key/check integrity and required extensions, and run an appropriate
   PostgreSQL integrity check on the isolated target. Preserve any pre-existing
   source gaps explicitly; do not modify production constraints for the drill.
5. Record elapsed restore time, safe aggregate results and exact check outcomes.
   Stop/remove only drill resources and remove private temporary dump copies
   after verification. The off-host backup and production volume remain intact.

For a repeat of the current small-database drill, download the selected object
privately through the Dokploy backup tab or an S3 client using the dedicated
credential from the operator's secret store. The commands below accept only a
local archive and a new offline container; run them in Bash. Increase the tmpfs
limit only after checking archive/database size and local capacity.

```bash
set -euo pipefail
umask 077
backup_archive=/private/path/downloaded.sql.gz
drill_dir=$(mktemp -d)
drill_container="altstack-restore-$(date -u +%Y%m%d%H%M%S)"
gzip -t "$backup_archive"
gzip -dc "$backup_archive" > "$drill_dir/backup.dump"

docker run -d --name "$drill_container" --network none \
  --memory 1g --cpus 1 --read-only --user 999:999 \
  --cap-drop ALL --security-opt no-new-privileges:true \
  --tmpfs /var/lib/postgresql:rw,nosuid,nodev,size=1g,uid=999,gid=999,mode=0700 \
  --tmpfs /var/run/postgresql:rw,nosuid,nodev,uid=999,gid=999 \
  --tmpfs /tmp:rw,nosuid,nodev,size=64m \
  -e PGDATA=/var/lib/postgresql/drill -e POSTGRES_DB=altstack_restore \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  postgres@sha256:edb0c08dc33befd0262ab3b5cf1c4f3f8cfd8b09e88c05b45adee29d6761ddb6

for attempt in {1..30}; do
  if docker exec "$drill_container" psql -X -U postgres -d altstack_restore \
    -Atc 'SELECT 1' > /dev/null 2>&1; then break; fi
  sleep 1
done
docker exec "$drill_container" psql -X -U postgres -d altstack_restore -Atc 'SELECT 1'
docker exec -i "$drill_container" pg_restore -U postgres -d altstack_restore \
  --exit-on-error --single-transaction --no-owner --no-acl \
  < "$drill_dir/backup.dump" > "$drill_dir/restore.private.log" 2>&1
docker exec "$drill_container" pg_amcheck -U postgres -d altstack_restore \
  --install-missing --heapallindexed --parent-check --rootdescend \
  > "$drill_dir/integrity.private.log" 2>&1
```

Before treating this as a passing drill, also complete the schema, migration,
row-content and constraint comparisons above. On completion, remove this exact
container with `docker rm -f "$drill_container"`, then delete the exact local
archive, decompressed file and private logs; remove the empty private directory.
On failure, keep diagnostics private while investigating and still stop/remove
the disposable container. Never copy a production connection URL into these
restore commands.

## Incident recovery

1. Identify the incident boundary and stop application writers and scheduled
   jobs through the operator's incident process. Preserve evidence and the
   current database; restoring over production requires separate authorization.
2. Select a completed, known-good object predating the incident. Verify its size,
   gzip/archive readability and recorded checksum when available. Check whether
   the incident requires an older backup than the newest retained object.
3. Recover into a new isolated PostgreSQL instance with a matching compatible
   version/extensions. Follow the drill checks before considering application
   cutover. Restore the matching immutable API/Web revisions and recover runtime
   configuration from the operator's secret store; database dumps alone do not
   back up images, Dokploy configuration, object assets or provider secrets.
4. Keep workers, email and external integrations stopped while checking recovered
   data. Outbox identities/statuses and auth/session data are copied by a full
   restore; do not clear or replay them blindly. Review restored sessions,
   pending decisions and provider idempotency before enabling delivery.
5. Prepare and obtain operator approval for the exact cutover plan. Change the
   application database target only after validation. Apply any necessary
   additive migrations through the normal release procedure; do not reset the
   migration journal. Confirm auth, public reads and admin access with secrets
   excluded from evidence, then deliberately resume jobs and inspect outcomes.
6. After recovery, verify a new off-host backup and repeat an isolated restore.
   Review actual data loss and recovery duration against the chosen objectives.

## Evidence and remaining follow-ups

- [x] Live PostgreSQL service/database/version and existing configuration checked.
- [x] Bucket created; public access and custom domains independently verified.
- [x] Separate bucket-scoped backup credential and destination tested.
- [x] Enabled schedule, scheduler timezone and retention configuration confirmed.
- [x] First manual backup completed and downloaded from off-host storage.
- [x] Isolated restore completed with zero restore errors.
- [x] Schema/migrations/data counts and integrity results recorded safely.
- [x] Temporary scheduled backup and actual 30-object retention pruning passed.
- [x] Temporary restore container, retention configuration and test objects removed.
- [ ] Confirm the first ordinary production daily execution at 03:00 WIB.
- [ ] Configure and test backup failure/freshness alerting with an operator-selected destination.
- [ ] Narrow the existing application storage token after checking its other consumers.
- [x] Private local dump, cached credential and comparison fingerprint copies removed after final verification.

Owner for the remaining follow-ups: deployment/storage operator (mrboxs).
The original backup/restore gap is closed by the off-host restore and pruning
evidence. Monitoring, credential hardening, the first ordinary daily execution
and a complete incident cutover remain separate, explicit limits.

References: [Dokploy database backups](https://docs.dokploy.com/docs/core/databases/backups),
[backup API](https://docs.dokploy.com/docs/api/backup),
[Dokploy restore](https://docs.dokploy.com/docs/core/databases/restore),
[R2 authentication](https://developers.cloudflare.com/r2/api/tokens/),
and [R2 public access](https://developers.cloudflare.com/r2/buckets/public-buckets/).
