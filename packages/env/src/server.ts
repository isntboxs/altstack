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
		BETTER_AUTH_COOKIE_DOMAIN: z.hostname().optional(),
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
		// Optional during build/local GitHub-only setup; email requests fail closed
		// until both server-only settings are configured.
		RESEND_API_KEY: z.string().min(1).optional(),
		RESEND_FROM_EMAIL: z.email().optional(),
		// Explicit web origin used for review links and email brand assets. The
		// dispatcher also requires it to match an existing trusted CORS origin.
		EMAIL_APP_URL: z.url().optional(),
		UPSTASH_REDIS_REST_URL: z
			.url()
			.refine((url) => url.startsWith('https://'), {
				message: 'Upstash Redis REST URL must use HTTPS',
			}),
		UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
		S3_ENDPOINT: z.url(),
		S3_REGION: z.string().min(1),
		S3_BUCKET: z.string().min(1),
		S3_ACCESS_KEY_ID: z.string().min(1),
		S3_SECRET_ACCESS_KEY: z.string().min(32),
		S3_PUBLIC_URL: z.url().transform((u) => u.replace(/\/$/, '')),
	},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
})
