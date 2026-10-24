# GitHub license, Archived, dan katalog lisensi

Production 2026-10-24: migration, revision API/Web dan backfill existing-job
terverifikasi. Katalog memiliki 20 listing dengan 17 lisensi SPDX yang dikenali
dan 3 unknown sesuai metadata GitHub. Lihat
[bukti production](production-verification-v0.4.0.md).
Pernyataan implementasi/QA di bawah adalah catatan branch semula.

Implemented pada worktree `feat-licenses-archived`, berbasis `04d19eb` (#117).
Dokumen ini mencatat implementasi dan verifikasi lokal, bukan deployment.

## Metadata dan tautan

`github_repositories` menyimpan `license_key`, `license_name`,
`license_spdx_id`, `license_slug`, `license_url`, serta nullable `archived`.
Nilai lama tetap null sampai refresh berhasil. Archived hanya tampil saat
GitHub melaporkan `archived: true`; inactivity tidak menentukan status ini.
Proyek archived tetap published sampai admin mengubah statusnya sendiri.

Normalisasi menggunakan [payload repository GitHub](https://docs.github.com/en/rest/repos/repos#get-a-repository)
dan [aturan deteksi GitHub](https://docs.github.com/en/rest/licenses/licenses#about-licenses).
Identifier diperiksa terhadap seluruh [SPDX License List 3.29.0](https://github.com/spdx/license-list-data/blob/v3.29.0/json/licenses.json),
termasuk identifier deprecated yang masih digunakan GitHub. Daftar 740 identifier
disimpan di `packages/shared/src/lib/spdx-license-ids.ts`; tidak ada request
tambahan ke SPDX atau GitHub pada page reads. Perbarui daftar dari sumber
resmi tersebut ketika versi baru diperlukan, lalu jalankan tes normalisasi.

Identifier yang dikenal memakai slug lowercase stabil, misalnya `mit`,
`apache-2.0`, dan `gpl-2.0+`. Label pada kartu/detail menaut ke
`/licenses/<slug>`. Di statistik detail, tombol **Read … license document**
di samping label membuka `html_url` HTTPS yang dilaporkan GitHub, atau dokumen
canonical `https://spdx.org/licenses/<ID>.html`. Field GitHub `url` merupakan
API JSON dan tidak digunakan sebagai tautan dokumen.

Null, NOASSERTION, LicenseRef/custom, identifier nonstandard, dan metadata
yang belum di-refresh tampil tepat **unknown**. Key/name/identifier dari
GitHub tetap disimpan untuk menghindari fabrikasi identitas. Tidak dibuat
tautan dokumen atau tautan label pada kartu/detail untuk unknown.

## Sinkronisasi dan identitas

`repos.get` pada submission awal/resubmit, admin create/publish/perubahan URL,
refresh manual/harian, serta import `--github` membawa license dan archived.
Refresh lengkap menyimpan seluruh snapshot secara atomik setelah fetch sukses.
Fetch gagal tidak menghapus metadata lama; snapshot sukses dengan lisensi null
atau `archived: false` memang menghapus deteksi/penanda sebelumnya.

Verifikasi dasar sukses sudah dapat menyimpan license/archived walaupun
enrichment commit/release best effort berikutnya gagal. Rename/transfer dengan
GitHub repository ID yang sama mempertahankan statistik/histori sebelumnya.
ID berbeda membersihkan metadata commit/release dan histori yang tidak terkait,
lalu menyimpan license/archived yang baru diamati. Proteksi revision/concurrent
refresh existing tetap digunakan. Tidak ada scheduler baru.

## Public browsing dan sort

`/licenses` mengikuti container, breadcrumb, warna, dan pola direktori kategori/tag
AltStack: 1/2/3 kolom, leader line, identifier, dan jumlah proyek. Urutan direktori
berdasarkan jumlah published projects menurun, lalu slug menaik.
Counts, lookup, search, dan kartu selalu membutuhkan status `published` serta
repository row; draft/rejected/removed, laporan dan submission privat tidak masuk.

`/licenses/unknown` adalah filter penemuan untuk lisensi tidak teridentifikasi,
termasuk custom dan proyek yang menunggu backfill. Ia tampil di direktori hanya
jika memiliki proyek publik, selalu `noindex, follow`, dan tidak masuk sitemap.
Ini tautan filter, bukan tautan dokumen lisensi. Slug yang tidak punya proyek
publik menghasilkan 404. Direktori kosong mempunyai empty state; kegagalan
request mempunyai retry; pencarian kosong dan page di luar rentang mempunyai
clear-filter/first-page recovery.

Katalog memakai `q`, `sort`, `page` tervalidasi, scope lisensi pada server,
debounced search, pagination yang mempertahankan filter, dan kontrol yang tetap
terpasang selama results loading. Sort/reset menyimpan history; perubahan teks
debounced memakai replace. Reload/back/forward memulihkan state URL. Uppercase
slug dialihkan 308 ke lowercase. Canonical/noindex mengikuti kategori/tag:
pencarian/sort nondefault tidak diindeks dan canonical ke base catalogue;
pagination default canonical per halaman; page di luar rentang noindex.
Direktori dan lisensi dikenal dengan proyek publik masuk sitemap.

Menu menampilkan, dalam urutan ini: Oldest, Latest, Most popular, Name (A to Z),
Name (Z to A), Most stars, Trending, Most forks, Last commit, Repository age.
Nilai query lama (`newest`, `oldest`, `name`, `most-stars`, `most-forks`) tetap valid.
Latest/Oldest memakai tanggal listing AltStack. Repository age menempatkan repo
tertua dahulu; Last commit menempatkan commit terbaru dahulu. Tanggal null terakhir.
Semua urutan diakhiri project ID agar ties/pagination deterministik.

Kebijakan ranking dipilih user di thread ini: **Most popular = total GitHub stars**,
jadi urutannya sama dengan Most stars. **Trending = delta total stars dari
pengamatan pertama dan terakhir dalam window tujuh tanggal WIB sebelum hari ini
sampai hari ini, inklusif**. Ini interval maksimum tujuh hari, bukan interpolasi
tujuh hari penuh bila observasinya jarang. Dua tanggal berbeda wajib tersedia;
nilai negatif tetap dihitung. Proyek dengan kurang dari dua observasi berada
terakhir, tanpa fallback ke stars/newest. Tidak ada keputusan ranking yang tertunda.

Semua kartu katalog home/category/tag/license memakai Stars → Last commit →
License, tanggal acuan respons API untuk hydration stabil, dan badge Archived.
Tautan judul dan lisensi terpisah tanpa nested anchors; hover description tetap
tersedia. Statistik detail mempertahankan Forks dan menaruh License tepat di atas
Repository. Statistik hover preview/Featured dan fitur Bookmark/Report tetap ada.

## Rollout yang masih perlu dijalankan operator

1. Terapkan migration additive `20261023175513_github-license-archived` sebelum
   server/web baru. Tidak ada migration otomatis saat startup dan tidak ada
   reset/backfill data dalam migration.
2. Build dengan `NODE_ENV=production`, deploy API/web dari revision yang sama.
   Ini mencegah `.env` development menghasilkan JSX development untuk runtime
   production. Environment GitHub/auth/storage yang ada tetap diperlukan.
3. Jalankan job existing di container server dari `/app`:
   `bun run apps/server/dist/jobs/github-refresh.mjs`. Batch hanya memilih
   published projects. Admin dapat refresh manual untuk status lain.
4. Periksa summary/failure log, label lisensi, link dokumen, archived/unknown,
   published-only counts, dan sinkronisasi harian existing 02:00 Asia/Jakarta.
   Jangan tambahkan scheduler metadata kedua. Trending memerlukan minimal dua
   observasi dalam window dan bertambah coverage setelah refresh harian berjalan.

Migration production, backfill repo sungguhan, dan scheduler target belum dijalankan.
GitHub pada automated tests di-mock; callback OAuth, live GitHub rate limits,
dan data lisensi target tetap membutuhkan acceptance setelah rollout.

## Pemeriksaan lokal yang dapat diulang

Gunakan `vp install`, kemudian `vp run db:test:start`. Semua DB/HTTP tests di bawah
memakai wrapper schema disposable lokal; jangan jalankan migration test terhadap
database aplikasi atau production.

```sh
vp run --filter @altstack/shared test run tests/github-license.test.ts
vp run --filter @altstack/db test:scoped -- vp run --filter @altstack/api test run tests/licenses.test.ts tests/github-refresh.test.ts tests/github-statistics-fetch.test.ts tests/admin-project-github-metadata.test.ts tests/project-search.test.ts tests/submission-resubmit.test.ts tests/submission-rate-limit.test.ts tests/tags.test.ts
vp run --filter @altstack/db test:scoped -- vp run --filter @altstack/db test run tests/github-license-migration.test.ts tests/seed-file-github.test.ts tests/seed-file-import.test.ts
vp run --filter web test:unit tests/public-category-routes.test.tsx tests/github-statistics.test.tsx tests/github-statistics-refresh.test.tsx tests/category-catalog-ui.test.tsx tests/seo.test.tsx
```

Web tests memerlukan public `VITE_*` values, seperti build web. Type checks
menggunakan `vp exec tsrs --noEmit -p <affected package>/tsconfig.json`;
format/lint hanya file berubah. Production build diperiksa untuk shared/db/api,
server dan web yang terdampak. Tidak menjalankan full root/recursive suite.

Setelah build production web dan server tersedia:

```sh
vp run --filter @altstack/db test:scoped -- vpx apps/web/tests/licenses-http.acceptance.ts
# Tambahkan --preview untuk mempertahankan server/schema sementara bagi T3 preview.
```

HTTP checks mencakup SSR directory/counts, scoped search, pagination, unknown,
missing/nonpublic 404, uppercase 308, noindex, serta home/category/tag/detail
consumers. Fixture tidak memakai credential GitHub atau layanan production.
Browser QA melalui T3 preview mencakup desktop/mobile, tema terang/gelap,
menu sort, search, internal links, pagination/history, metadata order dan fallback.
Hasil lokal pada 2026-10-24:

- Shared normalization/sort schema: 15 tes lulus.
- API fitur, refresh/identity/failure, create/update, resubmit/rate limit, tags,
  published-only search/counts dan semua sort: 188 tes di 9 file lulus.
- DB migration/import adapter/import storage: 35 tes lulus; migration upgrade
  diulang dengan metadata lama non-null dan repository ID tetap utuh, lulus.
- Web routes/controls/history, metadata/card links, existing category/tag routes,
  retry/empty/404, refresh invalidation dan SEO: 109 tes di 5 file lulus.
- Chromium component browser tests: 12 tes layout skeleton/Featured lulus pada
  viewport yang sudah dicakup suite (termasuk 1440/768/390 px).
- Existing daily-job CLI: 3 tes lulus. Tidak ada scheduler baru.
- HTTP production SSR: 13 public targets, uppercase canonical redirect, dan
  sitemap inclusion/exclusion lulus; database schema disposable.
- T3 preview: 1440 × 1000 dan 375 × 850, tema terang/gelap; directory counts,
  sepuluh opsi sort dalam urutan referensi, search/reset, pagination/back,
  card-to-license links, License di atas Repository, Archived, unknown tanpa
  document link dan horizontal-overflow checks sudah diperiksa.
- Scoped format/lint dan typecheck web/api/db/shared/server lulus. Build
  shared/db/api/server serta build web dengan `NODE_ENV=production` lulus;
  bundler masih mengeluarkan warning ukuran chunk/directive dependency.
  `vp env doctor` juga lulus.

Preview memakai salinan build lokal dan dependency workspace sehingga build
berikutnya tidak mengganti assets yang sedang diperiksa. `--preview` menjaga
server/schema sampai marker `stop-preview` dibuat pada folder evidence yang
tercetak atau batas 20 menit tercapai. Seluruh data preview sintetis. Hasil lokal
ini tidak memverifikasi GitHub atau deployment production.
