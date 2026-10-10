# Vite+ Monorepo Starter

A starter for creating a Vite+ monorepo.

## Development

Database development menggunakan PostgreSQL cloud. Konfigurasikan `.env` dari
`.env.example` dengan `DATABASE_URL` untuk `altstack_development`, termasuk
parameter SSL dari penyedia cloud. Terapkan migration dengan `vp run db:migrate`.

Wrapper `test:scoped` di bawah memakai schema sementara pada
`altstack_development`, lalu menghapus schema tes setelah selesai. Data aplikasi
dan riwayat migration di schema `public` tidak diubah.

- Check everything is ready:

```bash
vp run --filter @altstack/db test:scoped -- vp run ready
```

- Run the tests:

```bash
vp run --filter @altstack/db test:scoped -- vp run -r test
```

- Build the monorepo:

```bash
vp run -r build
```

- Run the development server:

```bash
vp run dev
```

## Submission rate limit

`submission.create` uses the oRPC Upstash adapter with a sliding window of five
attempts per ten minutes per authenticated account, including admins. Validated
attempts consume quota even if duplicate detection, the ten-open-draft cap,
GitHub verification, or storage later fails. Invalid and unauthenticated calls
do not consume quota. Redis errors and the five-second Redis request deadline
return a server error before submission work begins; there is no local fallback
or local rate-limit cache.

Set the required server-only `UPSTASH_REDIS_REST_URL` and
`UPSTASH_REDIS_REST_TOKEN`. Use a dedicated development Redis database locally.
Counters use `altstack:<NODE_ENV>:submission:create` prefixes, shared across all
instances in that environment. No database migration is required.

The RPC and REST handlers return HTTP 429 with `{ limit, remaining, reset }`
for quota rejection, where `reset` is an epoch timestamp in milliseconds. Both
handlers add `RateLimit-*` headers and `Retry-After` on quota rejection, exposed
through CORS. GitHub and draft-cap 429 errors have no quota payload. The form
keeps inputs editable, disables submission during the reset countdown, and
never retries automatically.

Mocked tests do not contact Upstash. To opt into the integration test, explicitly
provide dedicated development credentials as
`UPSTASH_DEVELOPMENT_REDIS_REST_URL` and
`UPSTASH_DEVELOPMENT_REDIS_REST_TOKEN`, set
`UPSTASH_RATELIMIT_INTEGRATION=1`, and run from `packages/api`:

```bash
vp test run tests/submission-rate-limit.integration.test.ts
```

The test uses a unique development prefix, two independent clients, and a
recreated instance. It cleans only its own prefixed keys. It never falls back to
the application's runtime credentials and rejects a production environment.
For full database-backed verification, use the disposable-schema wrapper:

```bash
vp run --filter @altstack/db test:scoped
```

## Deploy image dengan GitHub Actions

Saat ada push tag yang diawali `v` (misalnya `v1.0.0`), workflow `Publish Docker
images` membangun dua image dengan `ghcr.io/voidzero-dev/vite-plus:latest`
sebagai builder lalu mendorongnya ke Docker Hub.

- `<DOCKERHUB_USERNAME>/altstack-server:v1.0.0`
- `<DOCKERHUB_USERNAME>/altstack-web:v1.0.0`

Sebelum push pertama, buat repository Docker Hub dengan dua nama tersebut, lalu
tambahkan konfigurasi berikut pada repository GitHub di **Settings → Secrets and
variables → Actions**:

- Secret `DOCKERHUB_TOKEN`: Docker Hub access token dengan izin Read & Write.
- Variable `DOCKERHUB_USERNAME`: namespace Docker Hub tujuan.
- Variable `VITE_APP_NAME`
- Variable `VITE_APP_URL`
- Variable `VITE_SERVER_URL`

`VITE_*` adalah nilai publik yang dibake ke bundle Web; gunakan
URL production, misalnya `https://app.example.com`,
dan `https://api.example.com`. Jangan simpan secret
di build argument.

Setiap image memperoleh tag release yang sama (misalnya `:v1.0.0`) dan tag
`sha-<commit>`. Di Dokploy, gunakan tag release agar deploy dan rollback selalu
deterministik. Konfigurasi domain tetap menunjuk ke port internal `3009` untuk
API serta `3000` untuk Web.

## GitHub statistics refresh

Metadata aside, refresh manual admin, dan job harian tersedia. Lihat
[rollout, migration, token runtime, dan schedule Dokploy 02:00 Asia/Jakarta](docs/github-statistics-refresh.md).
Urutan rollout: migration nullable → deploy server/web → backfill pertama →
aktifkan schedule. Command dalam container server dari `/app`:
`bun run apps/server/dist/jobs/github-refresh.mjs`.
