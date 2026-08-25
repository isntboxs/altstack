import { drizzleAdapter } from '@better-auth/drizzle-adapter/relations-v2'
import type { BetterAuthOptions } from 'better-auth'
import {
	admin as adminPlugin,
	multiSession as multiSessionPlugin,
	openAPI as openAPIPlugin,
	username as usernamePlugin,
} from 'better-auth/plugins'

import { db } from '@altstack/db'
import * as schemas from '@altstack/db/schemas'

import { env } from '@altstack/env/server'

import { DEFAULT_ROLE, ROLES } from '@altstack/shared'

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
			schema: {
				user: schemas.user,
				account: schemas.account,
				session: schemas.session,
				verification: schemas.verification,
			},
		}),
		emailAndPassword: {
			enabled: true,
		},
		plugins: [
			adminPlugin({
				adminRoles: ['admin'],
				defaultRole: 'user',
			}),
			multiSessionPlugin(),
			openAPIPlugin(),
			usernamePlugin(),
		],
		secret: env.BETTER_AUTH_SECRET,
		session: {
			expiresIn: 60 * 60 * 24 * 3,
		},
		socialProviders: {
			github: {
				enabled: true,
				clientId: env.GITHUB_CLIENT_ID,
				clientSecret: env.GITHUB_CLIENT_SECRET,
			},
		},
		trustedOrigins: env.CORS_ORIGINS,
		user: {
			additionalFields: {
				role: {
					type: [...ROLES],
					defaultValue: DEFAULT_ROLE,
					input: false,
					required: true,
				},
			},
		},
	} satisfies BetterAuthOptions
}
