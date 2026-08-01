import { defineConfig } from 'vite-plus'

export default defineConfig({
	resolve: { tsconfigPaths: true },
	pack: {
		dts: {
			tsgo: true,
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
