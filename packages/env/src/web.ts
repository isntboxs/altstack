import { createEnv } from '@t3-oss/env-core'
import dotenv from 'dotenv'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

const __dirname = dirname(fileURLToPath(import.meta.url))

dotenv.config({ path: join(__dirname, '../../../.env') })

export const env = createEnv({
	clientPrefix: 'VITE_',
	client: {
		VITE_SERVER_URL: z.url(),
	},
	runtimeEnv: import.meta.env,
	emptyStringAsUndefined: true,
})
