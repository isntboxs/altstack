import { betterAuth } from 'better-auth'

import { createAuthConfig } from '@altstack/auth/config'

export function createAuth() {
	const config = createAuthConfig()

	return betterAuth(config)
}

export const auth = createAuth()
