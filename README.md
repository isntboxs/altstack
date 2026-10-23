# Vite+ Monorepo Starter

A starter for creating a Vite+ monorepo.

Featured Projects is curated by admins at `/admin/featured` and appears on public
project detail pages. See [behavior, migration and verification](docs/featured-projects.md).

## Seeding CSV dan JSON

Impor kategori, project, dan relasinya tanpa reset database atau migration baru:

```sh
vp run db:seed -- --projects ./data/projects.csv --categories ./data/categories.csv
vp run db:seed -- --projects ./data/projects.json --categories ./data/categories.json --github
vp run db:seed -- --categories ./data/categories.json --dry-run
```

Default project `draft`, record lama dilewati, dan GitHub hanya diakses dengan
`--github`. CLI hanya membutuhkan `DATABASE_URL` secara default; path file relatif
terhadap direktori pemanggil. `db:seed` menjalankan importer file; minimal satu
path project atau kategori wajib diberikan.
Lihat [format kolom, template, konsistensi transaksi, dan pengujian aman](docs/file-seeding.md).

## Development

### Browser testing (Playwright)

Browser test memakai Vitest Browser Mode dengan provider Playwright dan Chromium.
Versi `vitest` dan `@vitest/browser-playwright` mengikuti Vitest bawaan Vite+.
Import API test dari `vite-plus/test` dan API browser dari `vite-plus/test/browser`.
Ini menguji kode di browser asli; pengujian alur end-to-end aplikasi memakai
runner Playwright Test yang terpisah.

Jalankan dari root repository:

```sh
# Sekali setelah install dependency, dan ulangi setelah upgrade Playwright.
vp run test:browser:install

# Jalankan browser test saja, tanpa server aplikasi atau database.
vp run test:browser

# Watch dengan jendela Chromium untuk debugging lokal.
vp run --filter web test:browser:watch

# Jalankan unit test web saja.
vp run --filter web test:unit
```

Simpan browser test di `apps/web/tests/browser/**/*.browser.ts` atau
`*.browser.tsx`. Nama ini memisahkannya dari glob default unit test (`*.test.*`)
agar tidak dijalankan dalam Node. Konfigurasi ada di `apps/web/vitest.config.ts`;
script `test` web dan `vp run -r test` menjalankan project `unit` dan `browser`.
Tes awal memverifikasi crop gambar dan padding PNG/JPEG memakai Canvas serta
decoder gambar Chromium asli, tanpa mock DOM.

Di CI Linux yang didukung Playwright, install browser beserta library OS sebelum
menjalankan suite:

```sh
vp exec --filter web playwright install --with-deps chromium
```

### Type checking dan VS Code (tsrs)

Install dependency dari root repository dengan `vp install`. Type checker Rust
[tsrs](https://github.com/oxc-project/tsrs) dipin sebagai dev dependency; binary
native diambil dari npm sehingga tidak perlu memasang Rust.

```sh
# Periksa semua app/package menggunakan tsconfig masing-masing.
vp run typecheck

# Periksa satu app saja.
vp exec tsrs --noEmit -p apps/web/tsconfig.json
```

`vp run check` dan `vp run ready` juga menjalankan tsrs. `vp check` tetap memakai
type checker bawaan Vite+/Oxlint untuk lint bertipe. Jalankan perintah yang
menyertakan test lewat wrapper `test:scoped` pada bagian database di bawah.

Buka root repository di VS Code dan install extension rekomendasi
**TypeScript 7** (`TypeScriptTeam.native-preview`). Workspace sudah mengaktifkan
client TypeScript 7 dan mengarahkan `js/ts.tsdk.path` ke `.vscode/tsdk`.
Launcher `tsgo` di direktori itu meneruskan argumen dan stdio ke tsrs lokal,
sesuai mekanisme [editor setup tsrs](https://github.com/oxc-project/tsrs/blob/main/docs/LSP.md#editor-setup).

Jika diminta, izinkan penggunaan SDK workspace ini, lalu jalankan
**TypeScript 7: Restart Server** atau **Developer: Reload Window**. Periksa
channel Output **TypeScript 7** untuk memastikan server memakai path
`.vscode/tsdk/tsgo`; `vp exec tsrs --version` menampilkan versi tsrs yang dipakai.
Untuk melihat detail protokol, set `js/ts.trace.server` ke `verbose`.

Formatting dan lint editor tetap lewat Oxc/Vite+. Content mapper LSP dimatikan
karena belum didukung tsrs. Setup launcher ini mendukung Linux dan macOS ARM64,
mengikuti platform binary npm tsrs. Untuk kembali ke server TypeScript bawaan,
hapus override `js/ts.tsdk.path`, set `js/ts.experimental.useTsgo` ke `false`,
dan reload VS Code.

### Database dan perintah development

Database development dan test menggunakan PostgreSQL 18 di Docker Compose.
Salin `.env.example` ke `.env` saat setup pertama, lalu sesuaikan konfigurasi
aplikasi lainnya. `DATABASE_URL` menunjuk ke database `altstack` di port `5432`;
`TEST_DATABASE_URL` menunjuk ke `altstack_test` di port `5433`. Keduanya hanya
membuka port pada loopback lokal.

```sh
vp run db:start
vp run db:migrate
```

Data development tersimpan di named volume `altstack_postgres_data`.
`vp run db:stop` menghentikan container; `vp run db:down` menghapus container
tanpa menghapus volume. `vp run db:watch` menampilkan log PostgreSQL di terminal.
Jika mengganti `POSTGRES_PASSWORD`, sesuaikan password pada kedua URL; perubahan
variabel tersebut tidak mengganti password database pada volume yang sudah ada.

Database test menggunakan service `postgres-test` dengan profile `test` dan
penyimpanan sementara (tmpfs). `vp run test:docker` menyalakan service, menunggu database
siap, lalu menjalankan seluruh suite melalui wrapper `test:scoped`. Wrapper
menerapkan migration dan fixture ke schema sementara, kemudian menghapusnya
setelah selesai. Helper test hanya menerima database lokal `altstack_test` dan
tidak memakai `DATABASE_URL` sebagai fallback. Data development tetap terpisah.

```sh
vp run test:docker
vp run db:test:stop
vp run db:test:down
```

Untuk perintah verifikasi khusus, nyalakan database test terlebih dahulu dengan
`vp run db:test:start`, lalu gunakan wrapper di bawah. `test:isolated` untuk
acceptance lama hanya boleh mereset schema pada database `altstack_test`.

Private Bookmarks tersedia untuk user dan admin pada branch fitur ini. Lihat
[perilaku, rollout migrasi additive, dan verifikasi Bookmarks](docs/bookmarks.md).
Report / suggest correction untuk guest, user, dan admin tersedia melalui
`?dialog=report`; admin membaca dan memoderasi lewat `/admin/reports`.
Lihat [intake privat, inbox admin, batas abuse, dan rollout](docs/project-reports.md).

- Check everything is ready:

```bash
vp run db:test:start
vp run --filter @altstack/db test:scoped -- vp run ready
```

- Run the tests:

```bash
vp run test:docker
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

`submission.create` and `submission.resubmit` share the oRPC Upstash adapter and
a sliding window of five attempts per ten minutes per authenticated account,
including admins. Validated
attempts consume quota even if duplicate detection, the ten-open-draft cap,
ownership/state/revision checks, GitHub verification, or storage later fails.
Invalid and unauthenticated calls do not consume quota. Redis errors and the
five-second Redis request deadline
return a server error before submission work begins; there is no local fallback
or local rate-limit cache.

Set the required server-only `UPSTASH_REDIS_REST_URL` and
`UPSTASH_REDIS_REST_TOKEN`. Use a dedicated development Redis database locally.
Counters use `altstack:<NODE_ENV>:submission:create` prefixes, shared across all
instances in that environment. The existing `submission:create` namespace is
retained for both operations so deployment does not reset account counters.
Both operations share the per-account transaction lock protecting the
ten-open-draft cap and a GitHub identity lock protecting intake duplicates across
rename races.
No database migration is required.

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
- Variable `VITE_S3_PUBLIC_URL`: URL publik CDN/storage production, misalnya
  `https://cdn.example.com`. Wajib diisi untuk build image web.

`VITE_*` adalah nilai publik yang dibake ke bundle Web; gunakan
URL production, misalnya `https://app.example.com`,
dan `https://api.example.com`. Jangan simpan secret
di build argument.

Workflow memvalidasi seluruh variable `VITE_*` di atas tidak kosong sebelum
build web. Perubahan `VITE_*` membutuhkan rebuild dan deployment image web
baru; mengganti environment runtime di Dokploy saja tidak memperbarui bundle.

Setiap image memperoleh tag release yang sama (misalnya `:v1.0.0`) dan tag
`sha-<commit>`. Di Dokploy, gunakan tag release agar deploy dan rollback selalu
deterministik. Konfigurasi domain tetap menunjuk ke port internal `3009` untuk
API serta `3000` untuk Web.

### GitHub sign-in dan sesi SSR lintas subdomain

Web membaca sesi dari cookie pada request SSR, lalu meneruskannya ke API.
Cookie host-only milik API tidak ikut pada request ke Web: callback GitHub bisa
berhasil tetapi header tetap menampilkan **Sign in** dan `/submit` mengarahkan
ke login. Sesuai [panduan cookie Better Auth](https://better-auth.com/docs/concepts/cookies#cross-subdomain-cookies),
`BETTER_AUTH_COOKIE_DOMAIN` mengaktifkan cookie bersama hanya jika diisi.
Kosongkan/hapus variabel ini untuk localhost; cookie tetap host-only dan dapat
dipakai antar port localhost. Gunakan hostname yang sama untuk Web dan API
lokal, bukan campuran `localhost` dan `127.0.0.1`.

Untuk production saat ini, set **Environment runtime aplikasi API di Dokploy**:

```dotenv
NODE_ENV=production
BETTER_AUTH_URL=https://altstack-api.marvagency.net
BETTER_AUTH_COOKIE_DOMAIN=marvagency.net
CORS_ORIGINS=https://altstack.marvagency.net
```

`CORS_ORIGINS` juga menjadi daftar trusted origins Better Auth. Pertahankan
origin lain yang memang diperlukan secara eksplisit, tanpa wildcard. Domain
cookie berupa hostname tanpa skema, port, path, atau titik awal. Kedua hostname
saat ini bersaudara sehingga cakupan bersama terkecilnya `marvagency.net`;
cookie akan dikirim ke parent dan **semua subdomain**. Seluruh subdomain dalam
cakupan itu harus dipercaya. Jangan aktifkan pada parent yang juga menampung
layanan pihak lain yang tidak dipercaya; gunakan penataan domain/proxy lain
jika cakupan kepercayaan berubah.

Urutan rollout (tidak memerlukan migration database):

1. Bangun/publikasikan image server dan web baru dari commit perbaikan melalui
   proses release yang berlaku. Image `v0.1.0` lama belum memuat perbaikan ini.
   Web dibangun dengan `VITE_APP_URL=https://altstack.marvagency.net` dan
   `VITE_SERVER_URL=https://altstack-api.marvagency.net`, beserta variable publik
   `VITE_*` lain yang sudah diwajibkan workflow.
2. Simpan env runtime API di atas di Dokploy, pilih tag image baru untuk API dan
   Web, lalu pull/redeploy keduanya (API dahulu). Pertahankan secret/database/
   Redis/storage runtime yang sudah ada. `BETTER_AUTH_COOKIE_DOMAIN` dibaca saat
   proses API mulai; jangan menaruhnya atau secret di `VITE_*` maupun build args.
   Web juga harus memakai image baru untuk meneruskan pembaruan cookie sesi SSR.
3. Sebelum retest, hapus cookie auth lama lewat DevTools **Application/Storage →
   Cookies** pada kedua origin. Hapus seluruh cookie `better-auth.*` dan
   `__Secure-better-auth.*` (termasuk varian multi-session/chunk) yang host-only
   pada API/Web, serta sisa cookie parent dari percobaan sebelumnya. Jangan
   hanya mengandalkan sign-out: cookie host-only dan cookie parent bernama sama
   dapat hidup bersamaan dan menimbulkan konflik. Ini akan mengeluarkan sesi
   browser tersebut. Alternatif pengujian awal: profil incognito yang bersih.
4. Buka Web, **Sign in → Continue with GitHub**, lalu periksa cookie sesi:
   domain `.marvagency.net` (browser dapat menampilkan titik awal), path `/`,
   `HttpOnly`, `Secure`, dan `SameSite=Lax`. Nilai token tidak perlu disalin.
   Pastikan header berubah menjadi menu pengguna, hard reload tetap login,
   dan navigasi langsung/reload `/submit` terbuka tanpa redirect login.
5. Periksa `/api/auth/get-session` dengan `credentials: 'include'` hanya untuk
   status dan keberadaan session/user. Uji sign-out: header kembali **Sign in**
   dan request langsung `/submit` kembali ke
   `/auth/sign-in?returnTo=%2Fsubmit`. Pastikan browser juga menerima cookie
   sesi yang diperbarui saat sesi memasuki waktu refresh.

Perbaikan ini mempertahankan default `HttpOnly`, `Secure` untuk URL HTTPS,
`SameSite=Lax`, pemeriksaan origin, dan perlindungan CSRF Better Auth. Jangan
menonaktifkan pemeriksaan tersebut atau mengganti global ke `SameSite=None`.

Regresi lokal: `vp run --filter web test:auth-http` membangun project, menjalankan
API Bun dan SSR Node pada URL HTTP localhost dari `.env`, lalu menguji header,
guard `/submit`, refresh cookie SSR, dan sign-out dengan akun sintetis pada
schema sementara pada database lokal `altstack_test`. Pastikan port lokal Web/API kosong. Test cookie
HTTPS dengan parent domain eksplisit menggunakan adapter memori, tanpa GitHub
atau database production. Callback OAuth GitHub dan pengiriman cookie antar
hostname production tetap perlu retest setelah image baru di-deploy.

## GitHub + Magic Link authentication

Password signin/signup dinonaktifkan di server. Dialog dan `/auth/sign-in`
menyediakan GitHub dan Magic Link melalui Better Auth + Resend. Atur
`RESEND_API_KEY` dan `RESEND_FROM_EMAIL` hanya pada runtime server; sender harus
memakai domain yang sudah diverifikasi Resend. Terapkan migration auth sebelum
API baru untuk rate limit persisten. Lihat [alur akun, env, rollout, dan
verifikasi auth](docs/auth.md). Tes HTTP memakai email tiruan dan schema disposable;
pengiriman live serta callback OAuth sungguhan tetap perlu verifikasi staging.

## Submission review email notifications

Keputusan Published/Rejected untuk pengirim asli masuk ke outbox privat dalam
transaksi moderasi. Resend mengirim melalui job terpisah dengan retry dan
idempotency per keputusan. Seluruh template React Email berada di
`packages/ui/src/emails`; sender dan secret tetap di server.
Lihat [konfigurasi, migration, schedule dan batas retry](docs/review-notifications.md)
serta [preview HTML/teks sintetis](docs/email-previews/README.md).

## GitHub statistics refresh

Metadata aside, refresh manual admin, dan job harian tersedia. Lihat
[rollout, migration, token runtime, dan schedule Dokploy 02:00 Asia/Jakarta](docs/github-statistics-refresh.md).
Urutan rollout: migration nullable → deploy server/web → backfill pertama →
aktifkan schedule. Command dalam container server dari `/app`:
`bun run apps/server/dist/jobs/github-refresh.mjs`.
