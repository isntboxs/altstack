import { defineConfig } from 'vite-plus'

export default defineConfig({
	pack: {
		dts: {
			tsgo: true,
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
