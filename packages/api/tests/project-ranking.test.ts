import { createRouterClient } from '@orpc/server'
import { eq, inArray } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vite-plus/test'

import { recommendedProjectScore } from '@altstack/api/queries/project-ranking'
import { routers } from '@altstack/api/routers'

import { db } from '@altstack/db'
import {
	githubRepository,
	project,
	projectMember,
	user,
} from '@altstack/db/schemas'

const token = 'zqxrankingfixtures'
const now = new Date('2026-10-31T12:00:00+07:00')
const midnight = new Date('2026-10-31T00:00:00+07:00')
const daysAgo = (days: number) =>
	new Date(midnight.getTime() - days * 86_400_000)
const projectIds: Array<string> = []
const userIds: Array<string> = []
const client = createRouterClient(routers, { context: { db, auth: null } })

afterEach(async () => {
	if (projectIds.length > 0) {
		await db.delete(project).where(inArray(project.id, projectIds.splice(0)))
	}
	if (userIds.length > 0) {
		await db.delete(user).where(inArray(user.id, userIds.splice(0)))
	}
})

async function fixture(
	github: Partial<typeof githubRepository.$inferInsert> = {},
	options: { verified?: boolean; status?: 'published' | 'draft' } = {}
) {
	const id = randomUUID()
	projectIds.push(id)
	await db.insert(project).values({
		id,
		name: `${token} project`,
		slug: `ranking-${id}`,
		repositoryUrl: `https://github.com/ranking/${id}`,
		tagline: token,
		description: token,
		logo: 'test-fixtures/ranking.svg',
		status: options.status ?? 'published',
	})
	await db.insert(githubRepository).values({
		owner: 'ranking',
		repo: id,
		stars: 10_000,
		forks: 1_000,
		fetchedAt: now,
		metadataFetchedAt: now,
		repositoryCreatedAt: midnight,
		lastCommitAt: midnight,
		archived: false,
		licenseSlug: 'mit',
		...github,
		projectId: id,
	})
	if (options.verified) {
		const userId = randomUUID()
		userIds.push(userId)
		await db.insert(user).values({
			id: userId,
			name: 'Ranking maintainer',
			email: `${userId}@example.test`,
			role: 'user',
		})
		await db.insert(projectMember).values({
			projectId: id,
			userId,
			role: 'owner',
		})
	}
	return id
}

async function score(id: string, instant = now) {
	const [row] = await db
		.select({ score: recommendedProjectScore(instant) })
		.from(project)
		.innerJoin(githubRepository, eq(githubRepository.projectId, project.id))
		.where(eq(project.id, id))
	if (!row) throw new Error('Missing ranking fixture')
	return row.score
}

describe('Recommended ranking in PostgreSQL', () => {
	it('gives stars and forks equal normalized contributions, without a zero-count bonus', async () => {
		const stars = await fixture({ forks: 0 })
		const forks = await fixture({ stars: 0 })
		const both = await fixture()
		const empty = await fixture({ stars: 0, forks: 0 })
		expect(await score(stars)).toBeCloseTo(0.5, 10)
		expect(await score(forks)).toBeCloseTo(0.5, 10)
		expect(await score(both)).toBeCloseTo(1, 10)
		expect(await score(empty)).toBe(0)
		const larger = await fixture({ stars: 100_000, forks: 10_000 })
		expect(await score(larger)).toBeGreaterThan(1)
		expect(await score(larger)).toBeLessThan(2)
	})
	it('uses repository age, reaching half weight at five years without decaying further', async () => {
		const fresh = await fixture()
		const middle = await fixture({ repositoryCreatedAt: daysAgo(913.125) })
		const old = await fixture({ repositoryCreatedAt: daysAgo(1826.25) })
		const older = await fixture({ repositoryCreatedAt: daysAgo(3652.5) })
		await db
			.update(project)
			.set({ createdAt: daysAgo(3652.5) })
			.where(eq(project.id, fresh))
		expect(await score(fresh)).toBeCloseTo(1, 10)
		expect(await score(middle)).toBeCloseTo(0.75, 10)
		expect(await score(old)).toBeCloseTo(0.5, 10)
		expect(await score(older)).toBeCloseTo(0.5, 10)
	})
	it('keeps a 90-day activity grace period, then halves every 180 inactive days', async () => {
		for (const [days, expected] of [
			[0, 1],
			[90, 1],
			[270, 0.5],
			[450, 0.25],
		] as const) {
			const id = await fixture({ lastCommitAt: daysAgo(days) })
			expect(await score(id)).toBeCloseTo(expected, 10)
		}
	})
	it('distinguishes missing metadata from a confirmed empty repository and bounds future dates', async () => {
		const unknown = await fixture({
			repositoryCreatedAt: null,
			lastCommitAt: null,
			metadataFetchedAt: null,
			archived: null,
		})
		const empty = await fixture({ lastCommitAt: null })
		const future = await fixture({
			repositoryCreatedAt: daysAgo(-30),
			lastCommitAt: daysAgo(-30),
		})
		expect(await score(unknown)).toBeCloseTo(1, 10)
		expect(await score(empty)).toBe(0)
		expect(await score(future)).toBeCloseTo(1, 10)
	})
	it('adds exactly 5% for eligible verification and removes it when membership is revoked', async () => {
		const id = await fixture({}, { verified: true })
		expect(await score(id)).toBeCloseTo(1.05, 10)
		await db.delete(projectMember).where(eq(projectMember.projectId, id))
		expect(await score(id)).toBeCloseTo(1, 10)
	})
	it('reduces archived scores without hiding the listing', async () => {
		const id = await fixture({ archived: true })
		expect(await score(id)).toBeCloseTo(0.1, 10)
		expect(
			(
				await client.project.search({
					query: { q: token, sort: 'recommended' },
				})
			).projects.map((item) => item.id)
		).toEqual([id])
	})
	it('holds the time factors steady within a Jakarta day', async () => {
		const id = await fixture({
			repositoryCreatedAt: daysAgo(1000),
			lastCommitAt: daysAgo(300),
		})
		expect(await score(id, new Date('2026-10-31T00:00:01+07:00'))).toBe(
			await score(id, new Date('2026-10-31T23:59:59+07:00'))
		)
		expect(await score(id, daysAgo(-1))).toBeLessThan(await score(id))
	})
	it('orders the whole published result set before pagination and retains license filtering', async () => {
		// Relative to the real request day, so this also exercises the router's clock.
		const current = new Date()
		const verified = await fixture(
			{ lastCommitAt: current, repositoryCreatedAt: current },
			{ verified: true }
		)
		const active = await fixture({
			lastCommitAt: current,
			repositoryCreatedAt: current,
		})
		const archived = await fixture({
			stars: 100_000,
			forks: 10_000,
			lastCommitAt: current,
			repositoryCreatedAt: current,
			archived: true,
		})
		const stale = await fixture({
			stars: 100_000,
			forks: 10_000,
			lastCommitAt: new Date(current.getTime() - 810 * 86_400_000),
			repositoryCreatedAt: current,
			licenseSlug: 'apache-2-0',
		})
		await fixture({ stars: 1_000_000, forks: 100_000 }, { status: 'draft' })
		const query = { q: token, sort: 'recommended' as const }
		const all = await client.project.search({ query })
		expect(all.projects.map((item) => item.id)).toEqual([
			verified,
			active,
			archived,
			stale,
		])
		const first = await client.project.search({ query: { ...query, limit: 2 } })
		const second = await client.project.search({
			query: { ...query, limit: 2, page: 2 },
		})
		expect(
			[...first.projects, ...second.projects].map((item) => item.id)
		).toEqual(all.projects.map((item) => item.id))
		expect(first.pagination).toMatchObject({ totalItems: 4, totalPages: 2 })
		const filtered = await client.project.search({
			query: { ...query, license: 'mit' },
		})
		expect(filtered.projects.map((item) => item.id)).toEqual([
			verified,
			active,
			archived,
		])
	})
	it('breaks score ties by ID consistently across pages', async () => {
		const ids = [await fixture(), await fixture(), await fixture()]
		const actual: Array<string> = []
		for (let page = 1; page <= ids.length; page++) {
			const result = await client.project.search({
				query: { q: token, sort: 'recommended', page, limit: 1 },
			})
			actual.push(...result.projects.map((item) => item.id))
		}
		expect(actual).toEqual(ids.toSorted().toReversed())
	})
})
