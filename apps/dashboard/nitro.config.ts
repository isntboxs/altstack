import evlog from 'evlog/nitro/v3'
import { defineConfig } from 'nitro'

export default defineConfig({
	// Pin the production output target: without this, Nitro auto-detects the
	// runtime from the build environment (a Bun-based builder would emit
	// Bun-specific output that Node cannot run). Our Docker runtime is Node.
	preset: 'node-server',
	experimental: {
		asyncContext: true,
	},
	modules: [
		evlog({
			env: { service: 'altstack-dashboard' },
		}),
	],
})
