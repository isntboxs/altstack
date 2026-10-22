import { drizzleAdapter } from '@better-auth/drizzle-adapter/relations-v2'
import { betterAuth } from 'better-auth'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import { createAuthConfig } from '@altstack/auth/server/config'

import * as schemas from '@altstack/db/schemas'

import { connectTestPostgres } from '../../db/tests/helpers/postgres'
import { withWorkspaceDatabase } from '../../db/tests/helpers/workspace'

const { sent } = vi.hoisted(() => {
	return {
		sent: [] as Array<{ email: string; url: string }>,
	}
})
vi.mock('@altstack/db', () => {
	return { db: {} }
})
vi.mock('../src/server/magic-link-email', () => {
	return {
		sendMagicLinkEmail: (data: { email: string; url: string }) => {
			sent.push(data)
			return Promise.resolve()
		},
	}
})
vi.mock('@altstack/env/server', () => {
	return {
		env: {
			APP_NAME: 'AltStack test',
			BETTER_AUTH_URL: 'http://localhost:3009',
			BETTER_AUTH_SECRET: 'synthetic-test-secret-at-least-32-characters',
			CORS_ORIGINS: ['http://localhost:3010'],
			GITHUB_CLIENT_ID: 'synthetic-client',
			GITHUB_CLIENT_SECRET: 'synthetic-github-secret-at-least-32-characters',
		},
	}
})
afterEach(() => {
	sent.length = 0
})

async function withAuth(
	run: (
		auth: ReturnType<typeof betterAuth<ReturnType<typeof createAuthConfig>>>
	) => Promise<void>
) {
	const database = await connectTestPostgres()
	try {
		const scope = await database.createSchema()
		try {
			await withWorkspaceDatabase(scope, async () => {
				const config = createAuthConfig()
				const auth = betterAuth({
					...config,
					database: drizzleAdapter(scope.db, {
						provider: 'pg',
						schema: { ...schemas },
					}),
				})
				await run(auth)
			})
		} finally {
			await scope.close()
		}
	} finally {
		await database.close()
	}
}

function requestLink(
	auth: Parameters<Parameters<typeof withAuth>[0]>[0],
	email = 'synthetic@example.test'
) {
	return auth.handler(
		new Request('http://localhost:3009/api/auth/sign-in/magic-link', {
			method: 'POST',
			headers: {
				origin: 'http://localhost:3010',
				'content-type': 'application/json',
			},
			body: JSON.stringify({
				email,
				callbackURL: 'http://localhost:3010/submit',
			}),
		})
	)
}

describe('PostgreSQL Magic Link guarantees', () => {
	it('enforces the persistent mail quota under concurrent first requests across instances', async () => {
		await withAuth(async (auth) => {
			const second = betterAuth(auth.options)
			const results = await Promise.all(
				Array.from({ length: 7 }, (_, index) =>
					requestLink(index % 2 ? auth : second, `person-${index}@example.test`)
				)
			)
			expect(results.filter((result) => result.status === 200)).toHaveLength(5)
			expect(results.filter((result) => result.status === 429)).toHaveLength(2)
			expect(sent).toHaveLength(5)
		})
	})
	it('allows exactly one concurrent verification across auth instances', async () => {
		await withAuth(async (auth) => {
			expect((await requestLink(auth)).status).toBe(200)
			const second = betterAuth(auth.options)
			const url = sent[0]!.url
			const results = await Promise.all([
				auth.handler(new Request(url)),
				second.handler(new Request(url)),
			])
			expect(
				results.filter((result) => result.headers.getSetCookie().length > 0)
			).toHaveLength(1)
		})
	})
	it('verifies a legacy unverified user using framework cleanup and preserves their identity', async () => {
		await withAuth(async (auth) => {
			const context = await auth.$context
			const user = await context.internalAdapter.createUser(
				{
					email: 'synthetic@example.test',
					emailVerified: false,
					name: 'Legacy',
				},
				{ method: 'magic-link' }
			)
			await context.internalAdapter.createAccount({
				userId: user.id,
				accountId: user.id,
				providerId: 'credential',
				password: 'unproven-synthetic-hash',
			})
			const previous = await context.internalAdapter.createSession(user.id)
			expect((await requestLink(auth)).status).toBe(200)
			const result = await auth.handler(new Request(sent[0]!.url))
			expect(result.status).toBe(302)
			expect(result.headers.getSetCookie().length).toBeGreaterThan(0)
			expect(await context.internalAdapter.findAccounts(user.id)).toHaveLength(
				0
			)
			expect(
				await context.internalAdapter.findSession(previous.token)
			).toBeNull()
			expect(await context.internalAdapter.findUserById(user.id)).toMatchObject(
				{ id: user.id, emailVerified: true }
			)
		})
	})
})
