import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig, lazyPlugins } from 'vite-plus'

const config = defineConfig({
	resolve: { tsconfigPaths: true },
	plugins: lazyPlugins(() => [
		devtools(),
		nitro({ rollupConfig: { external: [/^@sentry\//] } }),
		tailwindcss(),
		tanstackStart(),
		viteReact(),
	]),
	run: {
		tasks: {
			build: {
				command: 'vp build',
				input: [{ auto: true }, '!.output/**'],
				output: ['.output/**'],
			},
		},
	},
})

export default config
