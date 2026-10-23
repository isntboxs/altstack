import { betterAuth } from 'better-auth'
import { eq, like } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import { createAuthConfig } from '@altstack/auth/server/config'

import type { db } from '@altstack/db'
import { rateLimit } from '@altstack/db/schemas'

import { connectTestPostgres } from '../../db/tests/helpers/postgres'
import { withWorkspaceDatabase } from '../../db/tests/helpers/workspace'
import { createMagicLinkRecipientLimiter } from '../src/server/magic-link-rate-limit'

const { sent } = vi.hoisted(() => {
	return { sent: [] as Array<{ email: string; url: string }> }
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
	vi.restoreAllMocks()
})

type TestAuth = ReturnType<
	typeof betterAuth<ReturnType<typeof createAuthConfig>>
>

async function withAuth(
	run: (
		auth: TestAuth,
		create: () => TestAuth,
		database: typeof db
	) => Promise<void>
) {
	const database = await connectTestPostgres()
	try {
		const scope = await database.createSchema()
		try {
			await withWorkspaceDatabase(scope, async () => {
				const create = () => betterAuth(createAuthConfig(scope.db))
				await run(create(), create, scope.db)
			})
		} finally {
			await scope.close()
		}
	} finally {
		await database.close()
	}
}

function requestLink(
	auth: TestAuth,
	email = 'synthetic@example.test',
	ip = '127.0.0.1'
) {
	return auth.handler(
		new Request('http://localhost:3009/api/auth/sign-in/magic-link', {
			method: 'POST',
			headers: {
				origin: 'http://localhost:3010',
				'content-type': 'application/json',
				'x-forwarded-for': ip,
			},
			body: JSON.stringify({
				email,
				callbackURL: 'http://localhost:3010/submit',
			}),
		})
	)
}

function recipientBuckets(database: typeof db) {
	return database
		.select()
		.from(rateLimit)
		.where(like(rateLimit.key, 'magic-link-recipient:%'))
}

const limitedBody = { message: 'Too many requests. Please try again later.' }

describe('PostgreSQL Magic Link guarantees', () => {
	it('rechecks the IP quota after concurrent updates wait on the same row lock', async () => {
		await withAuth(async (auth, create, database) => {
			for (let index = 0; index < 4; index++) {
				expect(
					(await requestLink(auth, `person-${index}@example.test`)).status
				).toBe(200)
			}
			const [bucket] = await database
				.select()
				.from(rateLimit)
				.where(eq(rateLimit.count, 4))
			expect(bucket).toBeDefined()
			const locker = await database.$client.connect()
			const pending: Array<Promise<Response>> = []
			try {
				await locker.query('BEGIN')
				const { rows } = await locker.query<{ pid: number }>(
					'SELECT pg_backend_pid() AS pid'
				)
				await locker.query(
					'SELECT id FROM rate_limit WHERE key = $1 FOR UPDATE',
					[bucket!.key]
				)
				pending.push(
					requestLink(auth, 'boundary-one@example.test'),
					requestLink(create(), 'boundary-two@example.test')
				)
				// Both UPDATE statements must see count=4 before either can commit.
				// Follow the lock chain because one waiter may queue behind the other.
				await vi.waitFor(
					async () => {
						const waiting = await database.$client.query<{ count: number }>(
							`WITH RECURSIVE blocked(pid) AS (
								SELECT $1::int
								UNION
								SELECT activity.pid FROM pg_stat_activity activity
								JOIN blocked ON blocked.pid = ANY(pg_blocking_pids(activity.pid))
							)
							SELECT count(*)::int AS count FROM blocked WHERE pid <> $1`,
							[rows[0]!.pid]
						)
						expect(waiting.rows[0]!.count).toBe(2)
					},
					{ timeout: 5000, interval: 20 }
				)
			} finally {
				await locker.query('ROLLBACK')
				locker.release()
				await Promise.allSettled(pending)
			}
			const results = await Promise.all(pending)
			expect(
				results.map((result) => result.status).toSorted((a, b) => a - b)
			).toEqual([200, 429])
			const denied = results.find((result) => result.status === 429)!
			expect(await denied.json()).toEqual(limitedBody)
			expect(Number(denied.headers.get('X-Retry-After'))).toBeGreaterThan(0)
			expect(denied.headers.getSetCookie()).toHaveLength(0)
			expect(sent.length).toBe(5)
			const [updated] = await database
				.select()
				.from(rateLimit)
				.where(eq(rateLimit.key, bucket!.key))
			expect(updated!.count).toBe(5)
			expect(
				(await requestLink(create(), 'after-boundary@example.test')).status
			).toBe(429)
			expect(sent.length).toBe(5)
		})
	})
	it('enforces the persistent IP quota under concurrent first requests across instances', async () => {
		await withAuth(async (auth, create) => {
			const second = create()
			const results = await Promise.all(
				Array.from({ length: 7 }, (_, index) =>
					requestLink(index % 2 ? auth : second, `person-${index}@example.test`)
				)
			)
			expect(results.filter((result) => result.status === 200)).toHaveLength(5)
			const denied = results.filter((result) => result.status === 429)
			expect(denied).toHaveLength(2)
			expect(await denied[0]!.json()).toEqual(limitedBody)
			expect(sent).toHaveLength(5)
		})
	})
	it('limits one normalized recipient across IPs and independent auth instances atomically', async () => {
		await withAuth(async (auth, create, database) => {
			const second = create()
			const results = await Promise.all(
				Array.from({ length: 12 }, (_, index) =>
					requestLink(
						index % 2 ? auth : second,
						index % 2 ? 'SYNTHETIC@EXAMPLE.TEST' : 'synthetic@example.test',
						`192.0.2.${index + 1}`
					)
				)
			)
			expect(results.filter((result) => result.status === 200)).toHaveLength(5)
			const denied = results.filter((result) => result.status === 429)
			expect(denied).toHaveLength(7)
			for (const result of denied) {
				expect(await result.json()).toEqual(limitedBody)
				expect(Number(result.headers.get('X-Retry-After'))).toBeGreaterThan(0)
				expect(Number(result.headers.get('X-Retry-After'))).toBeLessThanOrEqual(
					600
				)
				expect(result.headers.getSetCookie()).toHaveLength(0)
			}
			expect(sent).toHaveLength(5)
			const buckets = await recipientBuckets(database)
			expect(buckets).toHaveLength(1)
			expect(buckets[0]!.key).toMatch(/^magic-link-recipient:[a-f0-9]{64}$/)
			expect(buckets[0]!.key.includes('synthetic')).toBe(false)
			expect(
				(await requestLink(create(), 'synthetic@example.test', '198.51.100.1'))
					.status
			).toBe(429)
			expect(
				(await requestLink(create(), 'different@example.test', '198.51.100.2'))
					.status
			).toBe(200)
			expect(sent).toHaveLength(6)
		})
	})
	it('resets an expired recipient window atomically without extending it on denied attempts', async () => {
		await withAuth(async (auth, create, database) => {
			for (let index = 1; index <= 5; index++) {
				expect(
					(
						await requestLink(
							auth,
							'synthetic@example.test',
							`192.0.2.${index}`
						)
					).status
				).toBe(200)
			}
			const [bucket] = await recipientBuckets(database)
			expect(bucket).toBeDefined()
			const lastAllowed = Date.now() - 1000
			await database
				.update(rateLimit)
				.set({ lastRequest: lastAllowed })
				.where(eq(rateLimit.key, bucket!.key))
			expect(
				(await requestLink(create(), 'synthetic@example.test', '198.51.100.1'))
					.status
			).toBe(429)
			const [denied] = await recipientBuckets(database)
			expect(denied!.lastRequest).toBe(lastAllowed)
			expect(denied!.count).toBeLessThanOrEqual(6)
			await database
				.update(rateLimit)
				.set({ lastRequest: Date.now() - 600_001 })
				.where(eq(rateLimit.key, bucket!.key))
			const second = create()
			const results = await Promise.all(
				Array.from({ length: 7 }, (_, index) =>
					requestLink(
						index % 2 ? auth : second,
						'synthetic@example.test',
						`203.0.113.${index + 1}`
					)
				)
			)
			expect(results.filter((result) => result.status === 200)).toHaveLength(5)
			expect(results.filter((result) => result.status === 429)).toHaveLength(2)
			expect(sent).toHaveLength(10)
		})
	})
	it('fails closed with a generic error when recipient quota storage is unavailable', async () => {
		await withAuth(async (_auth, _create, database) => {
			const enforce = createMagicLinkRecipientLimiter(
				database,
				'synthetic-test-secret'
			)
			const failedQuery = vi
				.spyOn(database, 'insert')
				.mockImplementation(() => {
					throw new Error('private storage failure')
				})
			await expect(enforce('synthetic@example.test')).rejects.toMatchObject({
				status: 'SERVICE_UNAVAILABLE',
				body: {
					message:
						'Email sign-in is temporarily unavailable. Please try again later.',
				},
			})
			expect(sent).toHaveLength(0)
			failedQuery.mockRestore()
		})
	})
	it('allows exactly one concurrent verification across auth instances', async () => {
		await withAuth(async (auth, create) => {
			expect((await requestLink(auth)).status).toBe(200)
			const second = create()
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
