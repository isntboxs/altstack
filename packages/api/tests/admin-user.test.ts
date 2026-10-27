import { OpenAPIHandler } from '@orpc/openapi/fetch'
import { createRouterClient } from '@orpc/server'
import { RPCHandler } from '@orpc/server/fetch'
import { and, count, eq, sql } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { fileURLToPath } from 'node:url'
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from 'vite-plus/test'

import { routers } from '@altstack/api/routers'

import { createAuth } from '@altstack/auth/server'

import {
	account,
	auditLog,
	project,
	projectMember,
	rateLimit,
	verification,
	session,
	user,
} from '@altstack/db/schemas'

import { connectTestPostgres } from '../../db/tests/helpers/postgres'

const { mail } = vi.hoisted(() => {
	return { mail: [] as Array<{ url: string }> }
})
vi.mock('@altstack/auth/server/magic-link-email', () => {
	return {
		sendMagicLinkEmail: (data: { url: string }) => {
			mail.push(data)
			return Promise.resolve()
		},
	}
})
let postgres: Awaited<ReturnType<typeof connectTestPostgres>>
let scope: Awaited<ReturnType<typeof postgres.createSchema>>
beforeAll(async () => {
	postgres = await connectTestPostgres()
	scope = await postgres.createSchema()
	await migrate(scope.db, {
		migrationsFolder: fileURLToPath(
			new URL('../../db/src/migrations', import.meta.url)
		),
		migrationsSchema: scope.migrationsSchema,
	})
})
afterAll(async () => {
	await scope.close()
	await postgres.close()
})
beforeEach(async () => {
	await scope.db.delete(project)
	await scope.db.delete(auditLog)
	await scope.db.delete(user)
	await scope.db.delete(rateLimit)
	await scope.db.delete(verification)
	mail.length = 0
})

async function person(role = 'user', suffix = role) {
	const [row] = await scope.db
		.insert(user)
		.values({
			role,
			name: `Person ${suffix}`,
			email: `${suffix}@example.test`,
			emailVerified: true,
		})
		.returning()
	const auth = createAuth(scope.db)
	await auth.api.signInMagicLink({
		headers: new Headers({ origin: 'http://localhost:3010' }),
		body: { email: row!.email, callbackURL: 'http://localhost:3010' },
	})
	const response = await auth.handler(new Request(mail.at(-1)!.url))
	expect(response.status).toBe(302)
	const headers = new Headers({
		cookie: response.headers
			.getSetCookie()
			.map((value) => value.split(';')[0])
			.join('; '),
		origin: 'http://localhost:3010',
	})
	const identity = await auth.api.getSession({ headers })
	expect(identity?.user.id).toBe(row!.id)
	const client = createRouterClient(routers, {
		context: { db: scope.db, auth: identity, requestHeaders: headers },
	})
	return { row: row!, client, headers, auth, identity }
}
async function revision(actor: Awaited<ReturnType<typeof person>>, id: string) {
	return (await actor.client.admin.user.get({ params: { id } })).user.revision
}

describe('protected user management with real Better Auth sessions', () => {
	it('serves real REST and RPC reads, validates conservative actions and keeps member paths scoped', async () => {
		const admin = await person('admin'),
			target = await person('owner')
		const context = {
			db: scope.db,
			auth: admin.identity,
			requestHeaders: admin.headers,
		}
		const rest = new OpenAPIHandler(routers),
			rpc = new RPCHandler(routers)
		const listed = await rest.handle(
			new Request('http://localhost:3009/api/admin/users?q=owner&page=1', {
				method: 'QUERY',
			}),
			{ prefix: '/api', context }
		)
		expect(listed.response?.status).toBe(200)
		expect(await listed.response?.json()).toMatchObject({
			users: [{ id: target.row.id }],
			pagination: { page: 1 },
		})
		const read = await rpc.handle(
			new Request('http://localhost:3009/rpc/admin/user/get', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ json: { params: { id: target.row.id } } }),
			}),
			{ prefix: '/rpc', context }
		)
		expect(read.response?.status).toBe(200)
		expect(await read.response?.json()).toMatchObject({
			json: { user: { id: target.row.id } },
		})
		for (const body of [
			{ action: 'remove-user' },
			{ action: 'set-role', role: 'owner' },
			{ action: 'ban', reason: '  ' },
		]) {
			const result = await rest.handle(
				new Request(
					`http://localhost:3009/api/admin/users/${target.row.id}/actions`,
					{
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({
							...body,
							revision: await revision(admin, target.row.id),
						}),
					}
				),
				{ prefix: '/api', context }
			)
			expect(result.response?.status).toBe(400)
		}
		const [listing] = await scope.db
			.insert(project)
			.values({
				name: 'Scoped',
				slug: 'scoped',
				repositoryUrl: 'https://github.com/test/scoped',
				status: 'published',
			})
			.returning()
		await scope.db
			.insert(projectMember)
			.values({ projectId: listing!.id, userId: target.row.id, role: 'owner' })
		const members = await rest.handle(
			new Request(
				`http://localhost:3009/api/managed-projects/${listing!.id}/members?page=1&limit=1`,
				{ method: 'QUERY' }
			),
			{ prefix: '/api', context }
		)
		expect(members.response?.status).toBe(200)
		const data = (await members.response!.json()) as {
			members: Array<{ revision: string }>
		}
		const changed = await rest.handle(
			new Request(
				`http://localhost:3009/api/managed-projects/${listing!.id}/members/${target.row.id}`,
				{
					method: 'PATCH',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						role: 'maintainer',
						revision: data.members[0]!.revision,
					}),
				}
			),
			{ prefix: '/api', context }
		)
		expect(changed.response?.status).toBe(200)
		expect((await scope.db.select().from(projectMember))[0]!.role).toBe(
			'maintainer'
		)
	})
	it('rolls back native ban and session deletion if audit persistence fails', async () => {
		const admin = await person('admin'),
			target = await person()
		await scope.db.execute(
			sql`CREATE FUNCTION reject_account_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'user_banned' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$`
		)
		await scope.db.execute(
			sql`CREATE TRIGGER reject_account_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION reject_account_audit()`
		)
		try {
			await expect(
				admin.client.admin.user.action({
					params: { id: target.row.id },
					body: {
						action: 'ban',
						reason: 'Rollback check',
						revision: await revision(admin, target.row.id),
					},
				})
			).rejects.toBeDefined()
			expect(
				(
					await scope.db.select().from(user).where(eq(user.id, target.row.id))
				)[0]!.banned
			).toBe(false)
			expect(
				await target.auth.api.getSession({ headers: target.headers })
			).not.toBeNull()
		} finally {
			await scope.db.execute(
				sql`DROP TRIGGER reject_account_audit ON audit_log`
			)
			await scope.db.execute(sql`DROP FUNCTION reject_account_audit()`)
		}
	})
	it('searches and filters with bounded pagination and returns safe account details', async () => {
		const admin = await person('admin'),
			target = await person('maintainer')
		await scope.db.insert(account).values({
			userId: target.row.id,
			providerId: 'github',
			accountId: '123',
			accessToken: 'never-return-this',
			refreshToken: 'private-refresh',
		})
		const listing = await admin.client.admin.user.list({
			query: { q: target.row.email, role: 'maintainer', status: 'active' },
		})
		expect(listing.users.map((row) => row.id)).toEqual([target.row.id])
		expect(listing.pagination).toMatchObject({ totalItems: 1, limit: 25 })
		const details = await admin.client.admin.user.get({
			params: { id: target.row.id },
		})
		expect(details).toMatchObject({
			providers: ['github'],
			activeSessions: 1,
			memberships: [],
		})
		for (const value of [listing, details]) {
			expect(JSON.stringify(value)).not.toMatch(
				/never-return-this|private-refresh|session_token|"token"|ipAddress|userAgent/
			)
		}
		expect(
			(await admin.client.admin.user.list({ query: { q: '%_' } })).users
		).toEqual([])
		await expect(
			target.client.admin.user.list({ query: {} })
		).rejects.toMatchObject({ code: 'FORBIDDEN' })
		await expect(
			target.client.admin.user.action({
				params: { id: target.row.id },
				body: { action: 'set-role', role: 'admin', revision: '1' },
			})
		).rejects.toMatchObject({ code: 'FORBIDDEN' })
	})
	it('uses native role changes, revokes previous sessions, preserves memberships and rejects stale edits', async () => {
		const admin = await person('admin'),
			target = await person('owner')
		const [listing] = await scope.db
			.insert(project)
			.values({
				name: 'Owned',
				slug: 'owned',
				repositoryUrl: 'https://github.com/test/owned',
				status: 'published',
			})
			.returning()
		await scope.db
			.insert(projectMember)
			.values({ projectId: listing!.id, userId: target.row.id, role: 'owner' })
		const params = { id: target.row.id },
			version = await revision(admin, params.id)
		await admin.client.admin.user.action({
			params,
			body: { action: 'set-role', role: 'admin', revision: version },
		})
		expect(
			await target.auth.api.getSession({ headers: target.headers })
		).toBeNull()
		expect(
			(await admin.client.admin.user.get({ params })).memberships
		).toHaveLength(1)
		expect((await scope.db.select().from(projectMember))[0]!.role).toBe('owner')
		await expect(
			admin.client.admin.user.action({
				params,
				body: { action: 'ban', reason: 'Stale attempt', revision: version },
			})
		).rejects.toMatchObject({ code: 'CONFLICT' })
		const [event] = await scope.db
			.select()
			.from(auditLog)
			.where(eq(auditLog.action, 'user_role_changed'))
		expect(event).toMatchObject({
			actorId: admin.row.id,
			metadata: { userId: target.row.id, previousRole: 'owner', role: 'admin' },
		})
	})
	it('bans/unbans with Better Auth, rejects existing direct project writes, and updates verified state without deleting membership', async () => {
		const admin = await person('admin'),
			target = await person('owner')
		const [listing] = await scope.db
			.insert(project)
			.values({
				name: 'Owned',
				slug: 'owned',
				repositoryUrl: 'https://github.com/test/owned',
				status: 'published',
			})
			.returning()
		await scope.db
			.insert(projectMember)
			.values({ projectId: listing!.id, userId: target.row.id, role: 'owner' })
		const params = { id: target.row.id }
		await admin.client.admin.user.action({
			params,
			body: {
				action: 'ban',
				reason: 'Abusive account',
				revision: await revision(admin, params.id),
			},
		})
		expect(
			await target.auth.api.getSession({ headers: target.headers })
		).toBeNull()
		await expect(
			target.client.ownership.get({ params: { id: listing!.id } })
		).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
		await expect(
			target.client.ownership.upload({
				params: { id: listing!.id },
				body: {
					kind: 'logo',
					filename: 'logo.png',
					contentType: 'image/png',
					size: 10,
				},
			})
		).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
		const { projectIsVerified } =
			await import('@altstack/api/queries/ownership')
		const verified = async () =>
			(
				await scope.db
					.select({ verified: projectIsVerified })
					.from(project)
					.where(eq(project.id, listing!.id))
			)[0]!.verified
		expect(await verified()).toBe(false)
		expect(await scope.db.select().from(projectMember)).toHaveLength(1)
		const listed = await admin.client.admin.user.list({
			query: { status: 'banned' },
		})
		expect(listed.users.map((u) => u.id)).toEqual([params.id])
		await expect(
			target.auth.api
				.signInMagicLink({
					headers: new Headers({ origin: 'http://localhost:3010' }),
					body: { email: target.row.email },
				})
				.then(async () => target.auth.handler(new Request(mail.at(-1)!.url)))
		).resolves.toMatchObject({ status: 403 })
		expect(
			await scope.db.select().from(session).where(eq(session.userId, params.id))
		).toHaveLength(0)
		await admin.client.admin.user.action({
			params,
			body: { action: 'unban', revision: await revision(admin, params.id) },
		})
		expect(await verified()).toBe(true)
		expect(
			await target.auth.api.getSession({ headers: target.headers })
		).toBeNull()
	})
	it('revokes sessions without changing role and advances the action revision', async () => {
		const admin = await person('admin'),
			target = await person()
		const params = { id: target.row.id },
			version = await revision(admin, params.id)
		await admin.client.admin.user.action({
			params,
			body: { action: 'revoke-sessions', revision: version },
		})
		expect(
			await target.auth.api.getSession({ headers: target.headers })
		).toBeNull()
		expect((await admin.client.admin.user.get({ params })).user).toMatchObject({
			role: 'user',
			banned: false,
		})
		await expect(
			admin.client.admin.user.action({
				params,
				body: { action: 'revoke-sessions', revision: version },
			})
		).rejects.toMatchObject({ code: 'CONFLICT' })
	})
	it('prevents last-admin demotion and self-ban, permits deliberate self-demotion with another active admin', async () => {
		const admin = await person('admin'),
			params = { id: admin.row.id }
		await expect(
			admin.client.admin.user.action({
				params,
				body: {
					action: 'set-role',
					role: 'user',
					revision: await revision(admin, params.id),
				},
			})
		).rejects.toMatchObject({ code: 'CONFLICT' })
		await expect(
			admin.client.admin.user.action({
				params,
				body: {
					action: 'ban',
					reason: 'Self ban',
					revision: await revision(admin, params.id),
				},
			})
		).rejects.toMatchObject({ code: 'FORBIDDEN' })
		await person('admin', 'another-admin')
		await admin.client.admin.user.action({
			params,
			body: {
				action: 'set-role',
				role: 'user',
				revision: await revision(admin, params.id),
			},
		})
		expect(
			await admin.auth.api.getSession({ headers: admin.headers })
		).toBeNull()
		await expect(
			admin.client.admin.user.list({ query: {} })
		).rejects.toMatchObject({ code: 'FORBIDDEN' })
	})
	it.each(['set-role', 'ban'] as const)(
		'serializes concurrent reciprocal %s actions and never leaves zero active admins',
		async (action) => {
			const a = await person('admin', 'a'),
				b = await person('admin', 'b')
			const [va, vb] = await Promise.all([
				revision(a, a.row.id),
				revision(b, b.row.id),
			])
			const results = await Promise.allSettled([
				a.client.admin.user.action({
					params: { id: b.row.id },
					body:
						action === 'ban'
							? { action, reason: 'Concurrent ban', revision: vb }
							: { action, role: 'user', revision: vb },
				}),
				b.client.admin.user.action({
					params: { id: a.row.id },
					body:
						action === 'ban'
							? { action, reason: 'Concurrent ban', revision: va }
							: { action, role: 'user', revision: va },
				}),
			])
			expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
			const [admins] = await scope.db
				.select({ count: count() })
				.from(user)
				.where(and(eq(user.role, 'admin'), sql`${user.banned} is not true`))
			expect(admins!.count).toBe(1)
		}
	)
	it('blocks native HTTP admin bypasses, destructive account operations and foreign origins', async () => {
		const admin = await person('admin'),
			target = await person()
		for (const path of [
			'set-role',
			'ban-user',
			'remove-user',
			'impersonate-user',
			'set-user-password',
			'update-user',
			'create-user',
			'list-user-sessions',
		]) {
			const response = await admin.auth.handler(
				new Request(`http://localhost:3009/api/auth/admin/${path}`, {
					method: 'POST',
					headers: new Headers({
						cookie: admin.headers.get('cookie')!,
						origin: 'http://localhost:3010',
						'content-type': 'application/json',
					}),
					body: JSON.stringify({
						userId: target.row.id,
						role: 'admin',
						newPassword: 'unsafe-password',
						data: { emailVerified: true },
						email: 'new@example.test',
						name: 'New',
					}),
				})
			)
			expect(response.status).toBe(403)
		}
		const foreign = createRouterClient(routers, {
			context: {
				db: scope.db,
				auth: await admin.auth.api.getSession({ headers: admin.headers }),
				requestHeaders: new Headers({ origin: 'https://foreign.example.test' }),
			},
		})
		await expect(foreign.admin.user.list({ query: {} })).rejects.toMatchObject({
			code: 'FORBIDDEN',
		})
	})
})
