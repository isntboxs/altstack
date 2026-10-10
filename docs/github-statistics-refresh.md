# GitHub statistics: rollout dan operasi

Scope tambahan ini disetujui pada 10 Oktober 2026: stars/forks diperbarui harian
dan secara manual oleh admin; aside menampilkan HEAD commit default branch, umur
repository, dan tag latest release. Halaman publik membaca snapshot PostgreSQL.
Tidak ada graph, histori pertumbuhan 30 hari, license, atau self-hosted.

## Rollout

1. Terapkan migration nullable `github-statistics-metadata` dari checkout release
   dengan `vp run db:migrate` dan `DATABASE_URL` target deployment. Migration hanya
   menambahkan `last_commit_at`, `repository_created_at`, `latest_release_tag`,
   dan `metadata_fetched_at` ke `github_repositories`; row lama tetap valid.
   Jangan gunakan `db:push` untuk rollout. Timestamp metadata memakai timestamptz.
2. Deploy image server dan web dari revision yang sama setelah migration selesai.
   Berikan `GITHUB_TOKEN` di runtime server, bersama environment server yang sudah
   diwajibkan (`DATABASE_URL`, auth, Redis, dan storage). Token hanya perlu akses
   baca repository publik. Secret tidak dibake ke image atau bundle web.
3. Jalankan backfill pertama secara manual **di container server**, working
   directory `/app`:

   ```bash
   bun run apps/server/dist/jobs/github-refresh.mjs
   ```

   Periksa `github-refresh-summary` dan detail kegagalan dalam log. Snapshot lama
   tidak dihapus ketika fetch gagal. Backfill hanya memilih proyek `published`.
   Draft diisi secara best effort saat create, approval, atau perubahan repo;
   admin juga bisa memakai tombol **Refresh GitHub stats** untuk status apa pun.

4. Setelah backfill ditinjau, aktifkan schedule harian di Dokploy sesuai bagian
   berikut. Proyek gagal bisa dicoba lagi secara manual atau pada jadwal berikutnya.

Kode ini tidak menjalankan migration saat startup ataupun mengubah scheduler.
Deployment dan langkah di atas tetap perlu dilakukan oleh operator.

## Schedule Dokploy: setiap hari 02:00 Asia/Jakarta

[Dokumentasi resmi Schedule Jobs](https://docs.dokploy.com/docs/core/schedule-jobs)
menjelaskan bahwa Application/Compose jobs menjalankan command di container yang
dipilih melalui Docker exec dan menyediakan log setiap eksekusi. Container harus
running. Buat Application job untuk aplikasi **server** (atau Compose job untuk
service server jika deployment memakai Compose), dengan konfigurasi:

- Name: `github-statistics-daily`
- Command: `bun run apps/server/dist/jobs/github-refresh.mjs`
- Cron expression: `0 2 * * *`
- Timezone: `Asia/Jakarta`
- Enabled: aktifkan setelah manual backfill selesai.

Field `timezone` tersedia pada
[API resmi schedule.create/update](https://docs.dokploy.com/docs/api/schedule).
Pilih timezone pada schedule secara eksplisit; timezone browser bukan acuan cron.
Jika versi Dokploy belum menampilkan field timezone, upgrade atau gunakan cron
`0 19 * * *` dengan timezone schedule `UTC` (19:00 UTC = 02:00 WIB hari berikutnya).

Set `TZ=Asia/Jakarta` pada environment runtime **server** sehingga API dan CLI
dalam container yang sama menafsirkan timestamp `fetched_at` legacy secara sama.
Untuk timezone default instance Dokploy, dokumentasi
[Manual Installation](https://docs.dokploy.com/docs/core/manual-installation#setup-dokploy-timezone)
memberikan pola command yang dapat diterapkan operator:

```bash
docker service update --env-add TZ=Asia/Jakarta dokploy
```

Konfigurasi timezone instance tidak menggantikan timezone eksplisit pada schedule.
Uji command melalui run manual dan periksa waktu eksekusi schedule berikutnya
serta log. Jangan menambahkan proses cron kedua di container server.

## Perilaku refresh

Job memproses proyek secara berurutan. Kegagalan per repo dicatat dan batch lanjut;
rate limit GitHub menghentikan batch. Job menghasilkan selected/succeeded/failed,
skipped (batch lain memegang lock), dan rateLimited. Exit code `1` berarti ada
repo gagal, rate limit, atau kegagalan fatal; skipped karena overlap keluar `0`.
Jumlah belum diproses adalah selected dikurangi succeeded dan failed. Semua
koneksi DB ditutup ketika CLI selesai.

PostgreSQL advisory lock memakai koneksi khusus selama seluruh batch, berlaku
lintas container/replica pada database yang sama. Lock dilepas dari sesi yang
memperolehnya. Manual refresh tetap tersedia saat batch berjalan; pemeriksaan
revisi row memastikan snapshot yang kalah balapan tidak menimpa hasil yang baru.

Refresh lengkap menyimpan stars/forks, tanggal repository, tanggal **committer**
HEAD default branch (bukan `pushed_at`), dan `tag_name` latest release dalam satu
transaksi, bersama `fetchedAt` dan `metadataFetchedAt`. Tidak ada fallback ke tag
atau package. Repo kosong menyimpan commit null; repo tanpa release menyimpan tag
null. Respons sementara dan kegagalan akses mempertahankan snapshot sebelumnya.

Rename/transfer memperbarui URL proyek dan owner/repo bersama, dengan pemeriksaan
uniqueness proyek dan constraint GitHub. Perubahan repo yang disimpan admin
menghapus metadata repo lama. Refresh yang sedang berjalan memeriksa URL dan
revisi row, termasuk urutan repo A → B → A, sebelum menulis.

Aside memakai waktu acuan loader yang ikut diserialisasi untuk SSR/hydration dan
tanggal penuh dalam UTC pada tooltip. Metadata belum pernah diambil ditampilkan
sebagai `Unknown`; null dari fetch yang berhasil ditampilkan `No commits` atau
`No releases`. Waktu `Last refreshed` mengacu ke snapshot statistik tersimpan.
Tombol admin menggunakan `POST /admin/projects/{id}/github-refresh` dengan auth
admin yang sudah ada, tanpa retry otomatis; detail/list terkait diinvalidasi dan
nilai form yang belum disimpan tetap dipertahankan.

## Validasi development

```bash
vp install
vp check
vp run --filter @altstack/db test:scoped -- vp test run
vp run --filter @altstack/db test:scoped -- vp run -r test
vp run --filter 'server...' build
vp run web#build
```

`test:scoped` membuat schema sementara di `altstack_development`, menerapkan
migration dan taxonomy, lalu menghapus schema tersebut. Data `public` dan DB
produksi tidak diubah. Fetch GitHub dalam tes dimock; token produksi tidak
diperlukan untuk tes. Job deployment nyata membutuhkan `GITHUB_TOKEN` runtime.
