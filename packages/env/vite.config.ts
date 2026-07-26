import { defineConfig } from 'vite-plus'

export default defineConfig({
	resolve: { tsconfigPaths: true },
	pack: {
		dts: {
			tsgo: true,
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
