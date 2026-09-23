import { defineConfig } from 'vite-plus'

export default defineConfig({
	resolve: { tsconfigPaths: true },
	pack: {
		deps: { resolveDepSubpath: true },
		// No .d.ts: workspace consumers resolve to `src` via devExports and
		// nothing reads `dist` declarations — generating them only costs
		// build time. Typechecking happens in `vp check`.
		dts: false,
		exports: {
			enabled: true,
			devExports: true,
		},
		entry: ['./src/**/*.ts', '!./src/**/*.d.ts'],
		format: 'esm',
		outDir: 'dist',
		clean: true,
	},
	test: {
		// Vitest v4 compatibility: preserve mock call history.
		// Remove after tests no longer rely on calls from setup or earlier tests.
		// https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
		// https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
		clearMocks: false,
		environment: 'node',
		passWithNoTests: true,
	},
})
