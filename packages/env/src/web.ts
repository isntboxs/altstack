import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

export const env = createEnv({
	clientPrefix: 'VITE_',
	client: {
		VITE_APP_NAME: z.string(),
		VITE_APP_URL: z.url(),
		VITE_SERVER_URL: z.url(),
		VITE_S3_PUBLIC_URL: z.url().transform((u) => u.replace(/\/$/, '')),
	},
	runtimeEnv: import.meta.env,
	emptyStringAsUndefined: true,
})
