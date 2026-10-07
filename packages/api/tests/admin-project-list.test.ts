import { createRouterClient } from '@orpc/server'
import { inArray } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vite-plus/test'

import type { ORPCContext } from '@altstack/api/context'
import { routers } from '@altstack/api/routers'

import { db } from '@altstack/db'
import { githubRepository, project } from '@altstack/db/schemas'

const PREFIX = `test-admin-list-${crypto.randomUUID()}`
const adminClient = createRouterClient(routers, {
	context: {
		db,
		auth: {
			user: { id: crypto.randomUUID(), role: 'admin' },
		} as unknown as ORPCContext['auth'],
	},
})
const createdIds: Array<string> = []
const fixtures = [
	{ suffix: 'Zulu', status: 'published' },
	{ suffix: 'Beta', status: 'published' },
	{ suffix: 'Alpha', status: 'published' },
	{ suffix: 'Draft', status: 'draft' },
	{ suffix: 'Tie', status: 'published' },
	{ suffix: 'Tie', status: 'published' },
	{ suffix: 'Literal %_\\', status: 'published' },
	{ suffix: 'Literal xyz', status: 'published' },
] as const

beforeAll(async () => {
	for (const [index, fixture] of fixtures.entries()) {
		const slug = `${PREFIX}-${index}`
		const [row] = await db
			.insert(project)
			.values({
				name: `${PREFIX} ${fixture.suffix}`,
				slug,
				tagline: 'Admin list test',
				description: 'Admin list test',
				logo: 'https://example.com/logo.png',
				repositoryUrl: `https://github.com/test-admin-list/${slug}`,
				status: fixture.status,
				createdAt: new Date(Date.UTC(2025, 0, index + 1)),
			})
			.returning({ id: project.id })
		if (!row) throw new Error('Failed to create admin list fixture')
		createdIds.push(row.id)
		await db.insert(githubRepository).values({
			projectId: row.id,
			owner: 'test-admin-list',
			repo: slug,
			stars: 0,
			forks: 0,
			fetchedAt: new Date(),
		})
	}
})

afterAll(async () => {
	if (createdIds.length > 0) {
		await db.delete(project).where(inArray(project.id, createdIds))
	}
})

describe('admin project list', () => {
	it('filters names before pagination and counts every match', async () => {
		const result = await adminClient.admin.project.list({
			query: {
				name: `${PREFIX.toUpperCase()} ALP`,
				limit: 1,
				sort: 'name',
				order: 'asc',
			},
		})
		expect(result.projects.map((item) => item.id)).toEqual([createdIds[2]])
		expect(result.pagination).toMatchObject({
			page: 1,
			totalItems: 1,
			totalPages: 1,
			hasNextPage: false,
		})
	})

	it('sorts all matching projects before slicing each page', async () => {
		const pages = await Promise.all(
			[1, 2, 3, 4].map((page) =>
				adminClient.admin.project.list({
					query: {
						name: PREFIX,
						sort: 'name',
						order: 'asc',
						limit: 2,
						page,
					},
				})
			)
		)
		const names = pages.flatMap((page) =>
			page.projects.map((item) => item.name)
		)
		expect(names).toEqual(
			fixtures.map((fixture) => `${PREFIX} ${fixture.suffix}`).toSorted()
		)
		for (const page of pages) {
			expect(page.pagination.totalItems).toBe(fixtures.length)
			expect(page.pagination.totalPages).toBe(4)
		}
	})

	it('supports descending names and uses IDs to break ties across pages', async () => {
		const descending = await adminClient.admin.project.list({
			query: {
				name: PREFIX,
				sort: 'name',
				order: 'desc',
				limit: 2,
			},
		})
		expect(descending.projects.map((item) => item.name)).toEqual([
			`${PREFIX} Zulu`,
			`${PREFIX} Tie`,
		])
		const pages = await Promise.all(
			[1, 2].map((page) =>
				adminClient.admin.project.list({
					query: {
						name: `${PREFIX} Tie`,
						sort: 'name',
						order: 'desc',
						limit: 1,
						page,
					},
				})
			)
		)
		expect(pages.map((page) => page.projects[0]?.id)).toEqual(
			createdIds.slice(4, 6).toSorted().toReversed()
		)
	})

	it('combines status and name filters for rows and totals', async () => {
		const result = await adminClient.admin.project.list({
			query: {
				name: PREFIX,
				status: 'draft',
				limit: 1,
			},
		})
		expect(result.projects.map((item) => item.id)).toEqual([createdIds[3]])
		expect(result.pagination.totalItems).toBe(1)
	})

	it('treats SQL wildcard and escape characters as literal name text', async () => {
		const result = await adminClient.admin.project.list({
			query: {
				name: `${PREFIX} Literal %_\\`,
			},
		})
		expect(result.projects.map((item) => item.id)).toEqual([createdIds[6]])
		expect(result.pagination.totalItems).toBe(1)
	})

	it('preserves the default creation-date order and supports ascending dates', async () => {
		const newest = await adminClient.admin.project.list({
			query: {
				name: PREFIX,
				limit: 1,
			},
		})
		const oldest = await adminClient.admin.project.list({
			query: {
				name: PREFIX,
				sort: 'createdAt',
				order: 'asc',
				limit: 1,
			},
		})
		expect(newest.projects[0]?.id).toBe(createdIds[7])
		expect(oldest.projects[0]?.id).toBe(createdIds[0])
	})
})
