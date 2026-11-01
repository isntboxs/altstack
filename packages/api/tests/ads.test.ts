import { OpenAPIHandler } from '@orpc/openapi/fetch'
import { createRouterClient } from '@orpc/server'
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
	vi,
} from 'vite-plus/test'

import type { ORPCContext } from '@altstack/api/context'
import { adsRouter, adminAdsRouter } from '@altstack/api/routers/ads'
import { collectionRouter } from '@altstack/api/routers/collection'
import { projectRouter } from '@altstack/api/routers/project'
import type * as Storage from '@altstack/api/storage'

import {
	adCampaign,
	githubRepository,
	project,
	collection,
	collectionMember,
} from '@altstack/db/schemas'

import { campaignPeriod } from '@altstack/shared/schemas/ads'
import type { AdBody } from '@altstack/shared/schemas/ads'

import { connectTestPostgres } from '../../db/tests/helpers/postgres'
const storage = vi.hoisted(() => {
	return {
		promote: vi.fn(),
		cleanup: vi.fn().mockResolvedValue(undefined),
	}
})
vi.mock('@altstack/api/storage', async (importOriginal) => {
	return {
		...(await importOriginal<typeof Storage>()),
		promoteTempImageToAd: storage.promote,
		deleteFinalKeysBestEffort: storage.cleanup,
	}
})
let postgres: Awaited<ReturnType<typeof connectTestPostgres>>
let scope: Awaited<ReturnType<typeof postgres.createSchema>>
const ctx = (role?: 'admin' | 'user'): ORPCContext => {
	return {
		db: scope.db,
		auth: role
			? ({ user: { id: randomUUID(), role } } as ORPCContext['auth'])
			: null,
	}
}
const admin = () =>
	createRouterClient(adminAdsRouter, { context: ctx('admin') })
const publicClient = () => createRouterClient(adsRouter, { context: ctx() })
const body = (): AdBody => {
	return {
		name: 'Synthetic advertiser',
		description: 'Campaign integration fixture.',
		websiteUrl: 'https://ads.example.test',
		logo: 'tmp/logos/logo-1.png',
		banner: 'tmp/screenshots/wordmark-1.png',
		ctaText: 'Visit fixture',
		buttonColor: '#2563eb',
		tier: 'tier2',
		status: 'active',
		startMonth: new Date().toISOString().slice(0, 7),
		months: 1,
	}
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
	await scope.db.delete(adCampaign)
	storage.promote
		.mockReset()
		.mockImplementation((_key: string, id: string, kind: string) =>
			Promise.resolve(`ads/${id}/${kind}-${randomUUID()}.png`)
		)
	storage.cleanup.mockClear()
})
afterAll(async () => {
	await scope.close()
	await postgres.close()
})
describe('campaign CRUD and public eligibility', () => {
	it('preserves collection order across variable ad capacity using an explicit content offset', async () => {
		const [member] = await scope.db
			.insert(project)
			.values({
				name: 'Collection pagination member',
				slug: 'collection-pagination-member',
				description: 'Fixture',
				logo: 'test-fixtures/logo.png',
				repositoryUrl: 'https://github.com/fixtures/collection-member',
				status: 'published',
			})
			.returning()
		await scope.db.insert(githubRepository).values({
			projectId: member!.id,
			owner: 'fixtures',
			repo: 'collection-member',
			fetchedAt: new Date(),
		})
		const rows = await scope.db
			.insert(collection)
			.values(
				Array.from({ length: 50 }, (_, index) => {
					return {
						name: `Fixture collection ${index}`,
						slug: `fixture-collection-${index}`,
						description: 'Collection pagination fixture',
						content: '',
						kind: 'repository' as const,
						sourceRepositoryUrl: 'https://github.com/fixtures/list',
						authorName: 'Synthetic author',
						status: 'published' as const,
					}
				})
			)
			.returning()
		await scope.db.insert(collectionMember).values(
			rows.map((row) => {
				return { collectionId: row.id, projectId: member!.id, position: 0 }
			})
		)
		const client = createRouterClient(collectionRouter, { context: ctx() })
		const all = await client.list({ query: { page: 1, limit: 50 } })
		const first = await client.list({
			query: { page: 1, limit: 45, offset: 0 },
		})
		const second = await client.list({
			query: { page: 2, limit: 45, offset: 42 },
		})
		expect(second.offset).toBe(42)
		expect(
			[...first.collections.slice(0, 42), ...second.collections].map(
				(row) => row.id
			)
		).toEqual(all.collections.map((row) => row.id))
	})
	it('creates and edits monthly campaigns with optimistic concurrency, then deactivates and deletes', async () => {
		const created = await admin().create({ body: body() })
		expect(created.version).toBe(1)
		expect(created.startsAt).toEqual(
			campaignPeriod(created.startMonth, 1).startsAt
		)
		expect(created.logo).toMatch(new RegExp(`^ads/${created.id}/logo-`))
		expect(
			(await publicClient().list({})).campaigns.map((ad) => ad.id)
		).toEqual([created.id])
		const { version, ...saved } = created
		const updated = await admin().update({
			params: { id: created.id },
			body: { ...saved, status: 'inactive', expectedVersion: version },
		})
		expect(updated.version).toBe(2)
		expect((await publicClient().list({})).campaigns).toEqual([])
		await expect(
			admin().update({
				params: { id: created.id },
				body: { ...saved, expectedVersion: version },
			})
		).rejects.toMatchObject({ code: 'CONFLICT' })
		await expect(
			admin().delete({
				params: { id: created.id },
				body: { expectedVersion: version },
			})
		).rejects.toMatchObject({ code: 'CONFLICT' })
		await admin().delete({
			params: { id: created.id },
			body: { expectedVersion: updated.version },
		})
		expect(await admin().list({})).toEqual([])
		expect(storage.cleanup).toHaveBeenCalledWith([created.logo, created.banner])
	})
	it('filters drafts, future and expired rows at the public API independently of client TTL', async () => {
		const created = await admin().create({
			body: { ...body(), status: 'draft' },
		})
		await admin().create({ body: { ...body(), startMonth: '2020-01' } })
		await admin().create({ body: { ...body(), startMonth: '2099-01' } })
		expect((await publicClient().list({})).campaigns).toEqual([])
		expect((await admin().list({})).length).toBe(3)
		const { version, ...saved } = created
		await admin().update({
			params: { id: created.id },
			body: { ...saved, status: 'active', expectedVersion: version },
		})
		expect(
			(await publicClient().list({})).campaigns.map((ad) => ad.id)
		).toEqual([created.id])
	})
	it.each([undefined, 'user'] as const)(
		'rejects role %s through RPC and REST',
		async (role) => {
			const client = createRouterClient(adminAdsRouter, { context: ctx(role) })
			await expect(client.list({})).rejects.toMatchObject({
				code: role ? 'FORBIDDEN' : 'UNAUTHORIZED',
			})
			await expect(client.create({ body: body() })).rejects.toMatchObject({
				code: role ? 'FORBIDDEN' : 'UNAUTHORIZED',
			})
			const rest = new OpenAPIHandler({ admin: { ads: adminAdsRouter } })
			for (const method of ['QUERY', 'POST']) {
				const result = await rest.handle(
					new Request('http://localhost/api/admin/ads', {
						method,
						headers: { 'content-type': 'application/json' },
						...(method === 'POST' ? { body: JSON.stringify(body()) } : {}),
					}),
					{ prefix: '/api', context: ctx(role) }
				)
				expect(result.response?.status).toBe(role ? 403 : 401)
			}
		}
	)
	it('rejects unsafe links and reusing another campaign artwork', async () => {
		await expect(
			admin().create({ body: { ...body(), websiteUrl: 'javascript:alert(1)' } })
		).rejects.toMatchObject({ code: 'BAD_REQUEST' })
		const first = await admin().create({ body: body() })
		await expect(
			admin().create({ body: { ...body(), logo: first.logo } })
		).rejects.toMatchObject({ code: 'BAD_REQUEST' })
		expect(await admin().list({})).toHaveLength(1)
	})
	it('cleans promoted assets on a failed save and leaves original temporary uploads retryable', async () => {
		storage.promote
			.mockResolvedValueOnce('ads/promoted-logo.png')
			.mockRejectedValueOnce(new Error('S3 failed'))
		await expect(admin().create({ body: body() })).rejects.toMatchObject({
			code: 'INTERNAL_SERVER_ERROR',
		})
		expect(storage.cleanup).toHaveBeenCalledWith(['ads/promoted-logo.png'])
		expect(await admin().list({})).toEqual([])
	})
	it('enforces campaign constraints in the database', async () => {
		const values = {
			...body(),
			...campaignPeriod('2026-11', 1),
			buttonColor: 'invalid',
		}
		await expect(scope.db.insert(adCampaign).values(values)).rejects.toThrow(
			'Failed query'
		)
	})
	it('uses the supplied content boundary rather than page multiplied by current capacity', async () => {
		const names = Array.from(
			{ length: 50 },
			(_, i) => `adpage-${String(i).padStart(3, '0')}`
		)
		const rows = await scope.db
			.insert(project)
			.values(
				names.map((name) => {
					return {
						name,
						slug: name,
						description: 'Pagination fixture',
						tagline: 'Fixture',
						logo: 'test-fixtures/logo.png',
						repositoryUrl: `https://github.com/fixtures/${name}`,
						status: 'published' as const,
					}
				})
			)
			.returning()
		await scope.db.insert(githubRepository).values(
			rows.map((row) => {
				return {
					projectId: row.id,
					owner: 'fixtures',
					repo: row.slug,
					fetchedAt: new Date(),
				}
			})
		)
		const client = createRouterClient(projectRouter, { context: ctx() })
		const first = await client.search({
			query: { q: 'adpage', sort: 'name', page: 1, limit: 45, offset: 0 },
		})
		const next = await client.search({
			query: { q: 'adpage', sort: 'name', page: 2, limit: 45, offset: 42 },
		})
		expect(next.query?.offset).toBe(42)
		expect(
			[...first.projects.slice(0, 42), ...next.projects].map((row) => row.slug)
		).toEqual(names)
	})
})
