import { createEnv } from '@t3-oss/env-core'
import dotenv from 'dotenv'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

const __dirname = dirname(fileURLToPath(import.meta.url))

dotenv.config({ path: join(__dirname, '../../../.env') })

export const env = createEnv({
	server: {
		NODE_ENV: z.enum(['development', 'production', 'test']),
		PORT: z.coerce.number(),
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
					origins.every((origin) => z.url().safeParse(origin).success),
				{ message: 'Each origin must be a valid URL' }
			),
	},
	runtimeEnv: process.env,
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
	emptyStringAsUndefined: true,
})
