import type { BetterAuthOptions } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import {
	admin as adminPlugin,
	multiSession as multiSessionPlugin,
	openAPI as openAPIPlugin,
	username as usernamePlugin,
} from 'better-auth/plugins'
import { tanstackStartCookies } from 'better-auth/tanstack-start'

import { db } from '@altstack/db'

import { env } from '@altstack/env/server'

export function createAuthConfig() {
	return {
		account: {
			accountLinking: {
				enabled: true,
				trustedProviders: ['github'],
			},
			encryptOAuthTokens: true,
		},
		advanced: {
			database: {
				generateId: 'uuid',
			},
		},
		appName: env.APP_NAME,
		baseURL: env.BETTER_AUTH_URL,
		database: drizzleAdapter(db, {
			provider: 'pg',
		}),
		emailAndPassword: {
			enabled: true,
		},
		experimental: { joins: true },
		plugins: [
			adminPlugin(),
			multiSessionPlugin(),
			openAPIPlugin(),
			usernamePlugin(),
			tanstackStartCookies(),
		],
		secret: env.BETTER_AUTH_SECRET,
		session: {
			expiresIn: 60 * 60 * 24 * 3,
		},
		trustedOrigins: env.BETTER_AUTH_TRUSTED_ORIGINS,
	} satisfies BetterAuthOptions
}
