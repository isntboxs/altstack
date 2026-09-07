import { createRouterClient } from '@orpc/server'
import { eq, inArray } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vite-plus/test'

import { rpcHandler } from '@altstack/api/handler'
import { routers } from '@altstack/api/routers'

import { db } from '@altstack/db'
import {
	category,
	githubRepository,
	project,
	projectCategory,
} from '@altstack/db/schemas'

const client = createRouterClient(routers, {
	context: { db, auth: null },
})

// Unique FTS token so fixtures never collide with seed data.
const TOKEN = 'zqxwvr2'

const TEST_TIMEOUT = 30_000

interface FixtureOptions {
	slug: string
	name: string
	status?: 'draft' | 'published'
	stars?: number
	forks?: number
}

const createdProjectIds: Array<string> = []
const createdCategorySlugs: Array<string> = []

async function createFixtureProject({
	slug,
	name,
	status = 'published',
	stars = 1,
	forks = 0,
}: FixtureOptions) {
	const [row] = await db
		.insert(project)
		.values({
			name,
			slug,
			tagline: `${TOKEN} tagline for ${name}`,
			description: `${TOKEN} description for ${name}`,
			logo: 'https://example.com/logo.png',
			repositoryUrl: `https://github.com/test-r2/${slug}`,
			websiteUrl: null,
			content: null,
			status,
		})
		.returning({ id: project.id })

	if (!row) {
		throw new Error(`Failed to insert fixture project ${slug}`)
	}

	await db.insert(githubRepository).values({
		projectId: row.id,
		owner: 'test-r2',
		repo: slug,
		stars,
		forks,
		fetchedAt: new Date(),
	})

	createdProjectIds.push(row.id)
	return row.id
}

async function assignFixtureCategory(projectId: string, categorySlug: string) {
	const [row] = await db
		.select({ id: category.id })
		.from(category)
		.where(eq(category.slug, categorySlug))
		.limit(1)

	if (!row) {
		throw new Error(`Unknown fixture category ${categorySlug}`)
	}

	await db
		.insert(projectCategory)
		.values({ projectId, categoryId: row.id })
		.onConflictDoNothing({
			target: [projectCategory.projectId, projectCategory.categoryId],
		})
}

beforeAll(async () => {
	await db
		.insert(category)
		.values({
			slug: 'test-r2-tools',
			name: 'Test R2 Tools',
			description: 'Fixture category for R2 search tests.',
		})
		.onConflictDoNothing({ target: category.slug })
	createdCategorySlugs.push('test-r2-tools')

	await db
		.insert(category)
		.values({
			slug: 'test-r2-draftonly',
			name: 'Test R2 Draftonly',
			description: 'Fixture category attached to drafts only.',
		})
		.onConflictDoNothing({ target: category.slug })
	createdCategorySlugs.push('test-r2-draftonly')

	const alphaId = await createFixtureProject({
		slug: 'test-r2-alpha',
		name: `Zqxwvr2 Alpha`,
		stars: 10,
		forks: 2,
	})
	const zuluId = await createFixtureProject({
		slug: 'test-r2-zulu',
		name: `Zqxwvr2 Zulu`,
		stars: 50,
		forks: 7,
	})
	const draftId = await createFixtureProject({
		slug: 'test-r2-draft',
		name: `Zqxwvr2 Draft`,
		status: 'draft',
	})

	await assignFixtureCategory(alphaId, 'test-r2-tools')
	await assignFixtureCategory(zuluId, 'test-r2-tools')
	await assignFixtureCategory(draftId, 'test-r2-draftonly')
})

afterAll(async () => {
	if (createdProjectIds.length > 0) {
		await db.delete(project).where(inArray(project.id, createdProjectIds))
		createdProjectIds.length = 0
	}

	if (createdCategorySlugs.length > 0) {
		await db
			.delete(category)
			.where(inArray(category.slug, createdCategorySlugs))
		createdCategorySlugs.length = 0
	}
})

describe('searchProjects', () => {
	it(
		'finds published projects by text query with categories attached',
		{ timeout: TEST_TIMEOUT },
		async () => {
			const result = await client.project.search({ q: TOKEN })

			const slugs = result.projects.map((item) => item.slug)
			expect(slugs).toContain('test-r2-alpha')
			expect(slugs).toContain('test-r2-zulu')

			const alpha = result.projects.find(
				(item) => item.slug === 'test-r2-alpha'
			)
			expect(alpha?.categories).toContain('test-r2-tools')
		}
	)

	it('treats blank q like no query', { timeout: TEST_TIMEOUT }, async () => {
		const [blank, none] = await Promise.all([
			client.project.search({ q: '   ' }),
			client.project.search({}),
		])

		expect(blank.pagination.totalItems).toBe(none.pagination.totalItems)
	})

	it(
		'filters by a single category slug',
		{ timeout: TEST_TIMEOUT },
		async () => {
			const result = await client.project.search({
				category: 'test-r2-tools',
				limit: 50,
			})

			const slugs = result.projects.map((item) => item.slug).toSorted()
			expect(slugs).toEqual(['test-r2-alpha', 'test-r2-zulu'])
		}
	)

	it(
		'combines q, category, sort, and pagination together',
		{ timeout: TEST_TIMEOUT },
		async () => {
			const first = await client.project.search({
				q: TOKEN,
				category: 'test-r2-tools',
				sort: 'name',
				page: 1,
				limit: 1,
			})

			expect(first.projects.map((item) => item.slug)).toEqual(['test-r2-alpha'])
			expect(first.pagination).toMatchObject({
				page: 1,
				totalItems: 2,
				totalPages: 2,
				hasNextPage: true,
				hasPreviousPage: false,
			})

			const second = await client.project.search({
				q: TOKEN,
				category: 'test-r2-tools',
				sort: 'name',
				page: 2,
				limit: 1,
			})

			expect(second.projects.map((item) => item.slug)).toEqual(['test-r2-zulu'])
			expect(second.pagination.hasPreviousPage).toBe(true)
		}
	)

	it(
		'never exposes draft projects in any branch',
		{ timeout: TEST_TIMEOUT },
		async () => {
			const [byText, byCategory] = await Promise.all([
				client.project.search({ q: TOKEN, limit: 50 }),
				client.project.search({ category: 'test-r2-draftonly' }),
			])

			expect(byText.projects.map((item) => item.slug)).not.toContain(
				'test-r2-draft'
			)
			expect(byCategory.projects).toEqual([])
			expect(byCategory.pagination.totalItems).toBe(0)
		}
	)

	it(
		'returns an empty result for an unknown category slug',
		{ timeout: TEST_TIMEOUT },
		async () => {
			const result = await client.project.search({
				category: 'test-r2-no-such-category',
			})

			expect(result.projects).toEqual([])
			expect(result.pagination.totalItems).toBe(0)
		}
	)

	it(
		'orders by whitelisted sorts without arbitrary column ordering',
		{ timeout: TEST_TIMEOUT },
		async () => {
			const byName = await client.project.search({
				q: TOKEN,
				category: 'test-r2-tools',
				sort: 'name',
			})
			expect(byName.projects.map((item) => item.slug)).toEqual([
				'test-r2-alpha',
				'test-r2-zulu',
			])

			const byStars = await client.project.search({
				q: TOKEN,
				category: 'test-r2-tools',
				sort: 'most-stars',
			})
			expect(byStars.projects.map((item) => item.slug)).toEqual([
				'test-r2-zulu',
				'test-r2-alpha',
			])

			await expect(
				client.project.search({ sort: 'createdAt' as never })
			).rejects.toMatchObject({ code: 'BAD_REQUEST' })
		}
	)

	it(
		'rejects invalid sort and page with 400',
		{ timeout: TEST_TIMEOUT },
		async () => {
			await expect(
				client.project.search({ sort: 'trending' as never })
			).rejects.toMatchObject({ code: 'BAD_REQUEST' })

			await expect(client.project.search({ page: 0 })).rejects.toMatchObject({
				code: 'BAD_REQUEST',
			})
		}
	)

	it(
		'responds 400 over HTTP for invalid input',
		{ timeout: TEST_TIMEOUT },
		async () => {
			const request = new Request('http://localhost/api/rpc/project/search', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ json: { sort: 'trending', page: 0 } }),
			})

			const { matched, response } = await rpcHandler.handle(request, {
				prefix: '/api/rpc',
				context: { db, auth: null },
			})

			expect(matched).toBe(true)
			expect(response?.status).toBe(400)

			const valid = new Request('http://localhost/api/rpc/project/search', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ json: { q: TOKEN } }),
			})

			const validResult = await rpcHandler.handle(valid, {
				prefix: '/api/rpc',
				context: { db, auth: null },
			})

			expect(validResult.matched).toBe(true)
			expect(validResult.response?.status).toBe(200)
		}
	)
})

describe('listCategories', () => {
	it(
		'lists categories attached to published projects, ordered by name',
		{ timeout: TEST_TIMEOUT },
		async () => {
			const result = await client.project.listCategories({})

			const slugs = result.categories.map((item) => item.slug)
			expect(slugs).toContain('backend')
			expect(slugs).toContain('test-r2-tools')
			expect(slugs).not.toContain('test-r2-draftonly')

			const names = result.categories.map((item) => item.name)
			expect(names.toSorted()).toEqual(names)
		}
	)
})
