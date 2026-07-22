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
		PORT: z.coerce.number().int().min(0).max(65535),
	},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
})
