import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import type { RouterContractClient } from '@orpc/contract'
import { OpenAPIHandler, OpenAPILink } from '@orpc/openapi/fetch'
import { createRouterClient } from '@orpc/server'
import { RPCHandler } from '@orpc/server/fetch'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from 'vite-plus/test'

import type { ORPCContext } from '@altstack/api/context'

import { aboutPage } from '@altstack/db/schemas'

import { defaultAboutPage } from '@altstack/shared/schemas'

import { connectTestPostgres } from '../../db/tests/helpers/postgres'
import { aboutContract, adminAboutContract } from '../src/contracts/about'
import { aboutRouter, adminAboutRouter } from '../src/routers/about'

let postgres: Awaited<ReturnType<typeof connectTestPostgres>>
let scope: Awaited<ReturnType<typeof postgres.createSchema>>

function context(role?: 'admin' | 'user'): ORPCContext {
	return {
		db: scope.db,
		auth: role
			? ({
					user: { id: randomUUID(), name: 'Editor', role },
				} as ORPCContext['auth'])
			: null,
	}
}
const admin = () =>
	createRouterClient(adminAboutRouter, { context: context('admin') })
const reader = () => createRouterClient(aboutRouter, { context: context() })
const body = {
	title: 'About our directory',
	description: 'A useful directory.',
	content: '## Our purpose\n\nFind useful software.',
}

beforeAll(async () => {
	postgres = await connectTestPostgres()
	scope = await postgres.createSchema()
	await migrate(scope.db, {
		migrationsFolder: fileURLToPath(
			new URL('../../db/src/migrations', import.meta.url)
		),
		migrationsSchema: scope.migrationsSchema,
	})
}, 60000)
beforeEach(async () => {
	await scope.db.delete(aboutPage)
})
afterAll(async () => {
	await scope.close()
	await postgres.close()
})

describe('editable About page', () => {
	it.each(['rpc', 'openapi'] as const)(
		'supports reading and saving through the %s transport',
		async (transport) => {
			const routes = { about: aboutRouter, admin: { about: adminAboutRouter } }
			const contracts = {
				about: aboutContract,
				admin: { about: adminAboutContract },
			}
			const handler =
				transport === 'rpc'
					? new RPCHandler(routes)
					: new OpenAPIHandler(routes)
			const fetcher = async (request: Request) => {
				const result = await handler.handle(request, {
					prefix: '/api',
					context: context('admin'),
				})
				return result.response ?? new Response('Not found', { status: 404 })
			}
			const client = createORPCClient<RouterContractClient<typeof contracts>>(
				transport === 'rpc'
					? new RPCLink({
							origin: 'http://localhost',
							url: '/api',
							fetch: (request, init) => fetcher(new Request(request, init)),
						})
					: new OpenAPILink(contracts, {
							origin: 'http://localhost',
							url: '/api',
							fetch: (request, init) => fetcher(new Request(request, init)),
						})
			)
			expect(await client.about.get({})).toEqual(defaultAboutPage)
			const saved = await client.admin.about.update({
				body: { ...body, expectedVersion: 0 },
			})
			expect(saved.version).toBe(1)
			expect(await client.about.get({})).toEqual(saved)
		}
	)
	it('provides initial copy without creating a row on a public read', async () => {
		expect(await reader().get({})).toEqual(defaultAboutPage)
		expect(await admin().get({})).toEqual(defaultAboutPage)
		expect(await scope.db.select().from(aboutPage)).toHaveLength(0)
	})
	it('publishes the first save and subsequent updates immediately', async () => {
		const first = await admin().update({
			body: { ...body, expectedVersion: 0 },
		})
		expect(first).toMatchObject({
			...body,
			version: 1,
		})
		expect(first.updatedAt).toBeInstanceOf(Date)
		expect(await reader().get({})).toEqual(first)
		const second = await admin().update({
			body: {
				...body,
				content: '## Updated\n\nLatest copy.',
				expectedVersion: 1,
			},
		})
		expect(second.version).toBe(2)
		expect(await reader().get({})).toEqual(second)
		expect(await scope.db.select().from(aboutPage)).toHaveLength(1)
	})
	it.each([undefined, 'user'] as const)(
		'rejects non-admin access (%s) to editing endpoints',
		async (role) => {
			const client = createRouterClient(adminAboutRouter, {
				context: context(role),
			})
			const code = role ? 'FORBIDDEN' : 'UNAUTHORIZED'
			await expect(client.get({})).rejects.toMatchObject({ code })
			await expect(
				client.update({ body: { ...body, expectedVersion: 0 } })
			).rejects.toMatchObject({ code })
			expect(await reader().get({})).toEqual(defaultAboutPage)
		}
	)
	it.each([0, 1])(
		'allows only one concurrent writer for revision %i',
		async (version) => {
			if (version) {
				await admin().update({ body: { ...body, expectedVersion: 0 } })
			}
			const results = await Promise.allSettled([
				admin().update({
					body: { ...body, title: 'First editor', expectedVersion: version },
				}),
				admin().update({
					body: { ...body, title: 'Second editor', expectedVersion: version },
				}),
			])
			expect(
				results.filter((result) => result.status === 'fulfilled')
			).toHaveLength(1)
			expect(
				results.filter((result) => result.status === 'rejected')
			).toMatchObject([{ reason: { code: 'CONFLICT' } }])
			const winner = results.find((result) => result.status === 'fulfilled')
			expect(await reader().get({})).toEqual(winner?.value)
		}
	)
	it('rejects blank or oversized content without modifying the current page', async () => {
		for (const patch of [
			{ title: ' ' },
			{ description: ' ' },
			{ content: ' ' },
			{ content: 'a'.repeat(100001) },
		]) {
			await expect(
				admin().update({ body: { ...body, ...patch, expectedVersion: 0 } })
			).rejects.toMatchObject({ code: 'BAD_REQUEST' })
		}
		expect(await reader().get({})).toEqual(defaultAboutPage)
	})
})
