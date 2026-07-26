import { defineConfig } from 'vite-plus/test/config'

export default defineConfig({
	resolve: { tsconfigPaths: true },
	test: {
		environment: 'node',
		passWithNoTests: true,
	},
})
