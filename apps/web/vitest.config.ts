import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite-plus'
import { playwright } from 'vite-plus/test/browser-playwright'

export default defineConfig({
	resolve: { tsconfigPaths: true, dedupe: ['react', 'react-dom'] },
	test: {
		// Vitest v4 compatibility: preserve mock call history.
		// Remove after tests no longer rely on calls from setup or earlier tests.
		// https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
		// https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
		clearMocks: false,
		environment: 'node',
		passWithNoTests: true,
		projects: [
			{ test: { name: 'unit' } },
			{
				plugins: [tailwindcss(), react()],
				optimizeDeps: { include: ['reicon-react'] },
				test: {
					name: 'browser',
					// Keep browser-only files outside the default Node test glob.
					include: ['tests/browser/**/*.browser.{ts,tsx}'],
					browser: {
						enabled: true,
						headless: true,
						provider: playwright(),
						instances: [{ browser: 'chromium' }],
					},
				},
			},
		],
	},
})
