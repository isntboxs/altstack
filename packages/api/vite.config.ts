import { defineConfig } from 'vite-plus'

export default defineConfig({
	resolve: { tsconfigPaths: true },
	pack: {
		deps: { resolveDepSubpath: true },
		dts: {
			generator: 'tsgo',
		},
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
