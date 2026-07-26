import {
	inferAdditionalFields,
	multiSessionClient,
	usernameClient,
} from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

import type { auth } from '@altstack/auth'

import { env } from '@altstack/env/web'

export const authClient = createAuthClient({
	baseURL: env.VITE_APP_URL,
	plugins: [
		inferAdditionalFields<typeof auth>(),
		multiSessionClient(),
		usernameClient(),
	],
})
