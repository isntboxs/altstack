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
		entry: ['./src/**/*.ts', '!./src/**/*.d.ts'],
		format: 'esm',
		outDir: 'dist',
		clean: true,
	},
	test: {
		environment: 'node',
		passWithNoTests: true,
	},
})
