import { createEnv } from '@t3-oss/env-core'
import dotenv from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '../../../.env') })

export const env = createEnv({
	server: {
		NODE_ENV: z.enum(['development', 'production', 'test']),
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
