import evlog from 'evlog/nitro/v3'
import { defineConfig } from 'nitro'

export default defineConfig({
	// Pin the production output target: without this, Nitro auto-detects the
	// runtime from the build environment. Our Docker runtime is Bun
	// (oven/bun:1.4.1-slim running `.output/server/index.mjs`).
	preset: 'bun',
	// Same as apps/web: keep exactly ONE copy of React at runtime by
	// externalizing the React chain to `node_modules`. Otherwise Nitro bundles
	// `react`/`react-dom` into some SSR chunks while CJS `require("react")`
	// calls (e.g. inside `use-sync-external-store`, used by Base UI stores and
	// TanStack Store) stay as runtime imports — two React instances, null
	// dispatcher, `Cannot read properties of null (reading
	// 'useSyncExternalStore')` during SSR.
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
			env: { service: 'altstack-dashboard' },
		}),
	],
})
