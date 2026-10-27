import { betterAuth } from 'better-auth'

import { createAuthConfig } from '@altstack/auth/server/config'
import type { AuthDatabase } from '@altstack/auth/server/config'

export function createAuth(database?: AuthDatabase) {
	const config = createAuthConfig(database)

	return betterAuth(config)
}

export const auth = createAuth()

export { APIError } from 'better-auth/api'
