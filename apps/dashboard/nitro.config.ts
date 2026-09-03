import evlog from 'evlog/nitro/v3'
import { defineConfig } from 'nitro'

export default defineConfig({
	// Pin the production output target: without this, Nitro auto-detects the
	// runtime from the build environment (a Bun-based builder would emit
	// Bun-specific output that Node cannot run). Our Docker runtime is Node.
	preset: 'node-server',
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
