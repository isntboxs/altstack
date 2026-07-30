import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, lazyPlugins } from 'vite-plus'

const __dirname = dirname(fileURLToPath(import.meta.url))

const config = defineConfig({
	envDir: resolve(__dirname, '../..'),
	resolve: { tsconfigPaths: true },
	server: { port: 3010 },
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
