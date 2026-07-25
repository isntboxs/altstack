import { defineConfig } from 'vite-plus'

export default defineConfig({
	resolve: { tsconfigPaths: true },
	pack: {
		dts: {
			tsgo: true,
		},
		exports: true,
	},
	test: {
		environment: 'node',
		passWithNoTests: true,
	},
})
