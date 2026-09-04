import evlog from 'evlog/nitro/v3'
import { defineConfig } from 'nitro'

export default defineConfig({
	// Pin the production output target: without this, Nitro auto-detects the
	// runtime from the build environment. Our Docker runtime is Bun
	// (oven/bun:1.4.1-slim running `.output/server/index.mjs`).
	preset: 'bun',
	// Keep exactly ONE copy of React at runtime: resolve it (and its
	// companion packages) from `node_modules` instead of bundling. Background:
	// Nitro bundled `react`/`react-dom` into some SSR chunks while the CJS
	// `require("react")` calls inside `use-sync-external-store` (pulled in by
	// Base UI stores) stayed as runtime imports. Two React instances mean
	// `ReactCurrentDispatcher` is null on one of them, so SSR of any page
	// rendering Base UI's DialogRoot (Header -> AuthDialog, i.e. every page)
	// crashed with `Cannot read properties of null (reading
	// 'useSyncExternalStore')`. With the whole React chain external, server
	// chunks share the single `node_modules` copy (the Dockerfile already
	// ships prod `node_modules` next to `.output` for exactly this).
	// NOTE: `noExternals` was tried first but cannot rewrite the CJS
	// `require("react")` calls once emitted, so the external direction is used.
	rollupConfig: {
		external: [
			'react',
			'react-dom',
			'react-dom/server',
			'react/jsx-runtime',
			'react/jsx-dev-runtime',
			'scheduler',
			'use-sync-external-store',
		],
	},
	experimental: {
		asyncContext: true,
	},
	modules: [
		evlog({
			env: { service: 'altstack-web' },
		}),
	],
})
