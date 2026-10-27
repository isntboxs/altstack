import { and, count, eq, sql } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, beforeEach, expect, it } from 'vite-plus/test'

import {
	activeAccount,
	requireActiveAccount,
} from '@altstack/api/queries/account-access'
import {
	memberOfProject,
	projectIsVerified,
	requireProjectMember,
} from '@altstack/api/queries/ownership'

import { project, projectMember, user } from '@altstack/db/schemas'

import { connectTestPostgres } from '../../db/tests/helpers/postgres'

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
	await scope.db.delete(user)
})

it.each(['UTC', 'Asia/Jakarta', 'America/Los_Angeles'])(
	'keeps ban expiry, authorization, verified state and admin counts consistent in %s',
	async (timezone) => {
		const now = Date.now()
		const cases = [
			{ name: 'enabled', banned: false, banExpires: null, active: true },
			{ name: 'legacy', banned: null, banExpires: null, active: true },
			{ name: 'permanent', banned: true, banExpires: null, active: false },
			{
				name: 'future',
				banned: true,
				banExpires: new Date(now + 3600000),
				active: false,
			},
			{
				name: 'expired',
				banned: true,
				banExpires: new Date(now - 3600000),
				active: true,
			},
		]
		await scope.db.transaction(async (tx) => {
			await tx.execute(sql`select set_config('TimeZone', ${timezone}, true)`)
			for (const state of cases) {
				const [person] = await tx
					.insert(user)
					.values({
						name: state.name,
						email: `${state.name}@example.test`,
						role: 'admin',
						banned: state.banned,
						banExpires: state.banExpires,
					})
					.returning()
				const [listing] = await tx
					.insert(project)
					.values({
						name: state.name,
						slug: state.name,
						repositoryUrl: `https://github.com/test/${state.name}`,
						status: 'published',
					})
					.returning()
				await tx
					.insert(projectMember)
					.values({ projectId: listing!.id, userId: person!.id, role: 'owner' })
				const [result] = await tx
					.select({ active: activeAccount })
					.from(user)
					.where(eq(user.id, person!.id))
				const [publicState] = await tx
					.select({ verified: projectIsVerified })
					.from(project)
					.where(eq(project.id, listing!.id))
				expect(result!.active).toBe(state.active)
				expect(publicState!.verified).toBe(state.active)
				expect(
					!person!.banned ||
						(person!.banExpires !== null && person!.banExpires.getTime() <= now)
				).toBe(state.active)
				expect(
					await tx
						.select({ id: project.id })
						.from(project)
						.where(memberOfProject(person!.id))
				).toHaveLength(state.active ? 1 : 0)
				const [accountAccess, projectAccess] = await Promise.allSettled([
					requireActiveAccount(tx, person!.id),
					requireProjectMember(tx, listing!.id, person!.id),
				])
				expect(accountAccess).toMatchObject(
					state.active
						? { status: 'fulfilled', value: { id: person!.id, role: 'admin' } }
						: { status: 'rejected', reason: { code: 'UNAUTHORIZED' } }
				)
				expect(projectAccess).toMatchObject(
					state.active
						? { status: 'fulfilled', value: { role: 'owner' } }
						: { status: 'rejected', reason: { code: 'NOT_FOUND' } }
				)
			}
			const [admins] = await tx
				.select({ count: count() })
				.from(user)
				.where(and(eq(user.role, 'admin'), activeAccount))
			expect(admins!.count).toBe(3)
		})
	}
)
