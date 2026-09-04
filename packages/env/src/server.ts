import { createEnv } from '@t3-oss/env-core'
import dotenv from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '../../../.env') })

export const env = createEnv({
	server: {
		// NOTE: NODE_ENV is intentionally NOT set in `.env` — Vite warns
		// "NODE_ENV=production is not supported in the .env file" and ignores
		// it (only NODE_ENV=development is honored for dev builds). Vite sets
		// process.env.NODE_ENV itself (development for dev, production for
		// build), Docker sets ENV NODE_ENV=production, so default to
		// development for plain `bun run` local processes.
		NODE_ENV: z
			.enum(['development', 'production', 'test'])
			.default('development'),
		PORT: z.coerce.number().int().min(1).max(65535),
		DATABASE_URL: z.url(),
		APP_NAME: z.string(),
		BETTER_AUTH_URL: z.url(),
		BETTER_AUTH_SECRET: z.string().min(32),
		CORS_ORIGINS: z
			.string()
			.transform((cors) =>
				cors
					.split(',')
					.map((origin) => origin.trim())
					.filter((origin) => origin.length > 0)
			)
			.refine((origins) => origins.length > 0, {
				message: 'At least one origin is required',
			})
			.refine(
				(origins) =>
					origins.every((origin) => {
						try {
							const url = new URL(origin)
							return (
								(url.protocol === 'http:' || url.protocol === 'https:') &&
								url.username === '' &&
								url.password === '' &&
								url.pathname === '/' &&
								url.search === '' &&
								url.hash === ''
							)
						} catch {
							return false
						}
					}),
				{
					message:
						'Each origin must be an HTTP(S) origin without path, query, fragment, or credentials',
				}
			)
			.transform((origins) => origins.map((origin) => new URL(origin).origin)),
		GITHUB_CLIENT_ID: z.string(),
		GITHUB_CLIENT_SECRET: z.string().min(32),
		GITHUB_TOKEN: z.string().min(32).optional(),
	},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
})
