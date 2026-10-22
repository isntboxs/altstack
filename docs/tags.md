# Tags dari GitHub Topics

Tags memakai field `topics` dari metadata repository GitHub, bukan release tags.
Referensi upstream: https://docs.github.com/en/rest/repos/repos#get-a-repository.

`tags.slug` adalah identitas topic lowercase yang unik dan URL permanen.
`project_tags` menghubungkan banyak project ke tag yang sama. Sync membuat topic
yang belum ada, memakai tag existing, dan mengganti relasi project sesuai snapshot
terbaru. Topic kosong menghapus relasi project; row tag tetap ada untuk kurasi.

Sync berlangsung dalam transaksi penyimpanan metadata GitHub: submission baru,
resubmit, admin create/approval/perubahan repository, refresh manual, job harian,
dan file seed dengan `--github`. Fetch gagal tidak menghapus tags yang tersimpan.
Perubahan repository yang berhasil diverifikasi langsung mengganti tags walaupun
enrichment statistik lengkap sesudahnya gagal. Tidak ada request GitHub saat
membuka halaman publik.

## Kurasi admin

`/admin/tags` menyediakan create, list/search/pagination, edit, hide/unhide, dan
delete. Admin dapat mengedit nama tampilan dan deskripsi. Slug tidak dapat diubah,
agar identitas sync dan tautan tetap stabil. Sync tidak menimpa kurasi atau hidden.

Delete dibatasi untuk tag tanpa assignment, termasuk assignment ke draft dan
project rejected. Untuk tag yang masih dipakai, gunakan hidden. Tag hidden tidak
ditampilkan di directory, detail tag, tags project, atau pencarian dengan filter
tag. Delete tag kosong tidak memblokir topic tersebut; sync berikutnya boleh
membuatnya lagi. Semua endpoint mutasi dilindungi pemeriksaan role admin di API.

## Halaman publik

- `/tags`: breadcrumb, search `q`, sort `popular` / `name-asc` / `name-desc`, filter
  `letter=A` sampai `Z`, dan `letter=%26` untuk nama yang tidak dimulai A–Z.
- Pagination directory menggunakan `page`, 60 tags per halaman. Perubahan search,
  sort, atau letter kembali ke halaman pertama. Link pagination mempertahankan
  filter. Most Popular memakai jumlah project published, bukan total stars.
- `/tags/$slug`: katalog project published dengan pencarian, sort, dan pagination
  existing. Tag hidden, tidak dikenal, atau tanpa project publik menghasilkan 404.
- Detail project menampilkan link tags di bawah categories.

Tag kosong dan tag yang hanya dipakai project nonpublished tidak masuk directory.
Hitungan dan katalog juga mensyaratkan row repository seperti katalog existing.

## Rollout dan backfill

1. Jalankan `vp run db:migrate` sebelum deploy server/web revision ini. Migration
   additive hanya membuat tabel dan index, tanpa fetch GitHub.
2. Backfill project published dengan job existing di container server `/app`:
   `bun run apps/server/dist/jobs/github-refresh.mjs`. Ini juga memperbarui stats
   dan histori GitHub seperti sebelumnya. Pantau summary dan rate limit.
3. Job harian existing meneruskan sync. Admin dapat memakai **Refresh GitHub
   stats** pada project untuk mengambil topics segera, termasuk project draft.

Tidak diperlukan scheduler baru. File seed tanpa `--github` akan mendapat tags
pada refresh berikutnya.
