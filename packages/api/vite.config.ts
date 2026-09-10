import { defineConfig } from 'vite-plus'

export default defineConfig({
	resolve: { tsconfigPaths: true },
	pack: {
		deps: { resolveDepSubpath: true },
		// No .d.ts: the oRPC `Implementer` type carries the whole contract map,
		// so tsgo expands ~25k lines / 1.9 MB of declarations (~20s build) that
		// nothing consumes — workspace consumers resolve to `src` via
		// devExports, and typechecking happens in `vp check`.
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
