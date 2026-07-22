import { defineConfig } from 'vite-plus'

export default defineConfig({
	pack: {
		dts: {
			tsgo: true,
		},
		exports: true,
		entry: {
			'*': 'src/*.ts',
		},
		format: 'esm',
		outDir: 'dist',
		clean: true,
	},
	test: {
		environment: 'node',
		passWithNoTests: true,
	},
})
