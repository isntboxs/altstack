# Vite+ Monorepo Starter

A starter for creating a Vite+ monorepo.

## Development

- Check everything is ready:

```bash
vp run ready
```

- Run the tests:

```bash
vp run -r test
```

- Build the monorepo:

```bash
vp run -r build
```

- Run the development server:

```bash
vp run dev
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
