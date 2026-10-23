import { drizzleAdapter } from '@better-auth/drizzle-adapter/relations-v2'
import type { BetterAuthOptions } from 'better-auth'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import {
	admin as adminPlugin,
	multiSession as multiSessionPlugin,
	openAPI as openAPIPlugin,
} from 'better-auth/plugins'
import { magicLink } from 'better-auth/plugins/magic-link'
import { z } from 'zod'

import { ac, roles } from '@altstack/auth/server/permissions'

import { db } from '@altstack/db'
import * as schemas from '@altstack/db/schemas'

import { env } from '@altstack/env/server'

import { DEFAULT_ROLE, ROLES } from '@altstack/shared'

import { sendMagicLinkEmail } from './magic-link-email'
import {
	createMagicLinkRecipientLimiter,
	MAGIC_LINK_RATE_LIMIT,
} from './magic-link-rate-limit'

export function createAuthConfig(database = db) {
	const enforceRecipientLimit = createMagicLinkRecipientLimiter(
		database,
		env.BETTER_AUTH_SECRET
	)
	return {
		account: {
			accountLinking: {
				enabled: true,
				// Link only when GitHub proves the same email is verified.
				trustedProviders: [],
				allowDifferentEmails: false,
			},
			encryptOAuthTokens: true,
		},
		advanced: {
			crossSubDomainCookies: {
				enabled: Boolean(env.BETTER_AUTH_COOKIE_DOMAIN),
				domain: env.BETTER_AUTH_COOKIE_DOMAIN,
			},
			database: {
				generateId: 'uuid',
			},
		},
		appName: env.APP_NAME,
		baseURL: env.BETTER_AUTH_URL,
		database: drizzleAdapter(database, {
			provider: 'pg',
			schema: {
				user: schemas.user,
				account: schemas.account,
				session: schemas.session,
				verification: schemas.verification,
				rateLimit: schemas.rateLimit,
			},
		}),
		emailAndPassword: {
			enabled: false,
		},
		hooks: {
			before: createAuthMiddleware(async (ctx) => {
				if (ctx.path !== '/sign-in/magic-link') return
				const parsed = await z
					.looseObject({ email: z.email().max(254) })
					.safeParseAsync(ctx.body)
				if (!parsed.success) {
					throw new APIError('BAD_REQUEST', {
						message: 'Enter a valid email address.',
					})
				}
				return {
					context: {
						body: { ...parsed.data, email: parsed.data.email.toLowerCase() },
					},
				}
			}),
		},
		// Request method/path/status are logged by the API middleware. Never log
		// provider errors, verification URLs, or authentication payloads.
		logger: { disabled: true },
		plugins: [
			magicLink({
				expiresIn: 60 * 10,
				storeToken: 'hashed',
				rateLimit: MAGIC_LINK_RATE_LIMIT,
				sendMagicLink: async (data) => {
					await enforceRecipientLimit(data.email)
					await sendMagicLinkEmail(data)
				},
			}),
			adminPlugin({
				adminRoles: ['admin'],
				defaultRole: 'user',
				ac,
				roles,
			}),
			multiSessionPlugin(),
			openAPIPlugin(),
		],
		secret: env.BETTER_AUTH_SECRET,
		rateLimit: {
			enabled: true,
			storage: 'database',
			customRules: {
				'/magic-link/verify': { window: 60, max: 20 },
			},
		},
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
