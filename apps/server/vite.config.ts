import { defineConfig } from 'vite-plus'

export default defineConfig({
	pack: {
		dts: {
			tsgo: true,
		},
		entry: 'src/index.ts',
		format: 'esm',
		outDir: 'dist',
		clean: true,
	},
	test: {
		environment: 'node',
		passWithNoTests: true,
	},
})
