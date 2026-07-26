import 'dotenv/config'
import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

export const env = createEnv({
	server: {
		NODE_ENV: z.enum(['development', 'production', 'test']),
		DATABASE_URL: z.url(),
		APP_NAME: z.string(),
		BETTER_AUTH_URL: z.url(),
		BETTER_AUTH_SECRET: z.string().min(32),
		BETTER_AUTH_TRUSTED_ORIGINS: z
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
					origins.every((origin) => z.url().safeParse(origin).success),
				{ message: 'Each origin must be a valid URL' }
			),
	},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
})
