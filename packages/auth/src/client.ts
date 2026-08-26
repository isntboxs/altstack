import {
	inferAdditionalFields,
	multiSessionClient,
	usernameClient,
	customSessionClient,
} from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

import type { auth } from '@altstack/auth/server'

import { env } from '@altstack/env/web'

export const authClient = createAuthClient({
	baseURL: env.VITE_SERVER_URL,
	plugins: [
		inferAdditionalFields<typeof auth>(),
		customSessionClient<typeof auth>(),
		multiSessionClient(),
		usernameClient(),
	],
})
