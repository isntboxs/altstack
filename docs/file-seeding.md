# Seeding CSV dan JSON melalui CLI

Importer menambahkan project, kategori, path kategori, metadata GitHub, dan relasi
melalui Drizzle + PostgreSQL. Tidak ada reset database atau migration baru.
`vp run db:seed` tetap menjalankan seed bawaan yang sudah ada.

## Pemakaian

Dari root repository:

```sh
vp run db:seed:file -- --projects ./data/projects.csv --categories ./data/categories.csv
vp run db:seed:file -- --projects ./data/projects.json --github
vp run db:seed:file -- --categories ./data/categories.json --dry-run
vp run db:seed:file -- --help
```

Minimal satu dari `--projects` dan `--categories` wajib diberikan. Root script
menjalankan entrypoint langsung tanpa pindah ke `packages/db`; path relatif tetap
mengacu pada direktori pemanggil. Dari package database:

```sh
cd packages/db
vp run db:seed:file -- --projects ../../data/projects.json --categories ../../data/categories.json --dry-run
```

CLI memuat `.env` root tanpa menimpa environment pemanggil. Hanya `DATABASE_URL`
yang wajib tersedia. `GITHUB_TOKEN` opsional dan digunakan hanya dengan `--github`;
tanpa token, permintaan menggunakan kuota GitHub publik. Pool database milik CLI
ditutup setelah sukses maupun gagal. Modul parser, validasi, mesin importer, dan
adapter GitHub tidak membuat koneksi atau mengambil data saat diimpor.

Template tersedia dalam [projects.csv](../data/projects.csv),
[projects.json](../data/projects.json), [categories.csv](../data/categories.csv),
dan [categories.json](../data/categories.json). Ganti record contoh dengan data
sendiri sebelum impor. URL repository contoh bukan repository yang diverifikasi;
gunakan `--dry-run` tanpa `--github` untuk memeriksa struktur template.

## Format dan kolom

Ekstensi `.csv` atau `.json` menentukan parser. JSON harus berupa array object;
CSV memakai header dengan nama field yang sama, case-sensitive. CSV mendukung
kutipan, koma dalam kutipan, multiline, BOM UTF-8, CRLF, dan baris kosong.
Header duplikat, field asing (termasuk field kosong), atau jumlah kolom salah
ditolak. JSON opsional harus dihilangkan, bukan `null`. Sel CSV opsional kosong
dianggap tidak diberikan; sel wajib kosong gagal validasi. Array kosong JSON dan
CSV dengan hanya header valid menghasilkan impor tanpa perubahan.

Kategori:

- `name`: wajib, 2–100 karakter setelah trim.
- `slug`: wajib, maksimal 100 karakter input; mengikuti normalisasi slug aplikasi
  menjadi huruf kecil/angka dengan pemisah `-`.
- `description`: wajib, 1–300 karakter setelah trim.
- `parentSlug`: opsional; tanpa nilai berarti kategori root. Menggunakan aturan
  slug yang sama, dan boleh merujuk kategori dalam file atau database.

Project:

- `name`: wajib, 2–100 karakter setelah trim.
- `slug`: wajib, menggunakan aturan slug yang sama seperti kategori.
- `repositoryUrl`: wajib, mengikuti validasi GitHub aplikasi; `owner/repo`,
  HTTP/HTTPS, `www`, kapitalisasi, `.git`, dan path branch dinormalisasi menjadi
  `https://github.com/owner/repo`.
- `tagline`: opsional, maksimal 100 karakter setelah trim; default database `null`.
- `description`: opsional, maksimal 300 karakter setelah trim; default `null`.
- `logo`, `screenshot`: opsional, URL HTTP(S) atau final storage key yang memenuhi
  schema media aplikasi, misalnya `projects/example-editor/logo-{uuid}.png` atau
  `projects/example-editor/screenshot-{uuid}.webp`. Key `tmp/*` ditolak. Importer
  tidak mengunggah, menyalin, atau memverifikasi keberadaan gambar.
- `websiteUrl`: opsional, URL HTTP(S), default `null`.
- `content`: opsional, teks/Markdown yang dipertahankan sebagaimana diberikan,
  default `null`. JSON `content: ""` tetap diprioritaskan terhadap README.
- `status`: opsional, default `draft`; nilai yang tersedia adalah `draft`,
  `published`, `rejected`, dan `removed` sesuai enum aplikasi.
- `categorySlugs`: opsional, default `[]`; array pada JSON atau daftar `|` pada
  CSV (contoh `ai-editors|general-editors`). Slug dinormalisasi dan dideduplikasi,
  maksimal tiga kategori langsung. Semua kategori harus tersedia dan berupa daun.

`published` harus memenuhi `publishProjectSchema` yang dipakai API: nama, slug,
repository valid, logo, tagline dan description nonempty, serta 1–3 kategori daun.
Draft boleh tanpa media/copy/kategori. Kategori tidak dikenal tidak dibuat otomatis.

## Konsistensi dan impor ulang

Kategori baru diurutkan berdasarkan dependensi parent sehingga urutan baris bebas.
Hierarki maksimal tiga tingkat, tidak boleh bersiklus. Parent dengan project
langsung (termasuk draft) tidak dapat memperoleh anak. Path baru tidak boleh
mengambil path historis yang dimiliki kategori lain.

Kategori lama dicocokkan berdasarkan slug. Project lama dicocokkan berdasarkan
slug atau repository kanonis, termasuk varian URL lama. Jika keduanya menunjuk
dua project berbeda, impor gagal sebagai konflik. Duplikat slug dan repository
kanonis dalam satu file juga gagal. Record lama dilewati seluruhnya: ID,
timestamp, metadata, path, dan relasi tidak diperbarui/dilengkapi. Karena itu
`parentSlug` dan `categorySlugs` pada record yang dilewati tidak mengubah hierarki
atau relasi lama; record input tetap harus lolos validasi field/publikasi.

Semua penulisan dilakukan dalam satu transaksi. Perencanaan dan penulisan
menggunakan advisory lock yang sama dengan API:
`pg_advisory_xact_lock(hashtext('altstack.category-integrity'), hashtext(current_schema()))`.
Kesalahan validasi, konflik, atau kegagalan penulisan membatalkan seluruh impor.
Tidak ada `ON CONFLICT` yang diam-diam menimpa data lama.

## GitHub dan dry-run

Default tidak mengakses jaringan. Setiap project baru tetap mempunyai record
`github_repositories` dengan owner/repo dari URL kanonis, stars/forks nol,
metadata nullable `null`, dan `fetchedAt` epoch (`1970-01-01`) sebagai penanda
belum diambil. Importer tidak membuat riwayat stars sintetis, termasuk saat
`--github` aktif.

`--github` mengambil statistik (stars/forks, ID repository, tanggal pembuatan,
commit terakhir, release terbaru) dan README hanya untuk project baru. Repository
harus publik. Repository kosong boleh memiliki commit terakhir `null`; repository
tanpa release memiliki release `null`. Statistik gagal membatalkan impor sebelum
penulisan. README hilang/gagal/tidak valid menghasilkan peringatan; content dari
file diprioritaskan. README diambil sebagai teks UTF-8 (maksimal 100 KiB).
Pengambilan terjadi sebelum transaksi penulisan; URL hasil rename/transfer
dinormalisasi dan konflik diperiksa ulang bersama kondisi database terbaru.

`--dry-run` membaca database dan memvalidasi rencana lengkap tanpa menulis.
Pengambilan GitHub tetap mengikuti flag `--github`. Jumlah `dibuat` pada dry-run
adalah jumlah yang direncanakan, bukan perubahan yang sudah disimpan.

Output menampilkan jumlah dibuat/dilewati untuk kategori, path, project, metadata
GitHub, dan relasi, beserta peringatan. Jumlah dilewati metadata/path/relasi
menghitung row lama milik record yang dilewati. Kesalahan mencantumkan file,
baris fisik akhir record CSV atau index array JSON (mulai dari 0), field, dan
penyebab; kesalahan dokumen/header memakai lokasi dokumen. Kegagalan memberi exit
code nonzero.

## Validasi aman

Ikuti root README sebagai sumber utama verifikasi. Jangan memakai
`test:isolated`, menjalankan demo seed yang mengakses jaringan, atau mengimpor
template ke schema aplikasi untuk pengujian.

```sh
vp install
vp check
vp run --filter @altstack/db test:scoped -- vp run -r test
```

Tes importer memakai schema sementara dari `tests/helpers/postgres.ts`, termasuk
tes CLI sebenarnya. API/tes lain di suite memakai schema disposable milik wrapper.
Tidak ada reset `public` atau `drizzle` aplikasi. Tes GitHub memakai mock.

Versi awal mencakup CSV/JSON. Excel, UI upload, seed pengguna, dan pembaruan
record lama berada di luar cakupan.
