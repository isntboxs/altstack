# Web app

React with TanStack Start/Router/Query, Tailwind CSS, and Nitro SSR. Follow the
[root setup](../../README.md#run-locally), then run from the repository root:

```sh
vp run dev:web
```

The development app listens at `http://localhost:3010` and uses the separately
running API. Public configuration comes from root `.env` `VITE_*` values and is
embedded at build time.

File routes live in [src/routes](src/routes), feature UI/queries in
[src/features](src/features), and shared components in `packages/ui`.
The TanStack plugin generates the route tree; do not edit generated files.

```sh
vp run --filter 'web...' build
vp run --filter web test:unit tests/project-embed.test.tsx
```

Production output is `.output/server/index.mjs`, run with Node, as packaged by
the [Dockerfile](Dockerfile). Browser and HTTP acceptance tests are explicit
separate commands. See [development](../../docs/development.md) for targeted
verification, assets, and editor setup, and the [PRD](../../docs/prd.md#functional-requirements)
for the product workflows.
