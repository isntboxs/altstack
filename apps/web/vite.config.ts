import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact, { reactCompilerPreset } from '@vitejs/plugin-react'
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
		nitro({ preset: 'bun', rollupConfig: { external: [/^@sentry\//] } }),
		tailwindcss(),
		tanstackStart(),
		viteReact(),
		babel({ presets: [reactCompilerPreset()] }),
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
