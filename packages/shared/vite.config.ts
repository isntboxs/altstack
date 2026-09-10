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
		format: 'esm',
		outDir: 'dist',
		clean: true,
		entry: ['src/**/*.ts'],
	},
	test: {
		environment: 'node',
		passWithNoTests: true,
	},
})
