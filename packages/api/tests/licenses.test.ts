import { createRouterClient } from '@orpc/server'
import { inArray } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vite-plus/test'

import { octokit } from '@altstack/api/github'
import { openApiHandler } from '@altstack/api/handler'
import { routers } from '@altstack/api/routers'

import { db } from '@altstack/db'
import {
	githubRepository,
	githubStarHistory,
	project,
} from '@altstack/db/schemas'

import { normalizeGithubLicense } from '@altstack/shared/lib/github-license'
import {
	githubSnapshotDate,
	shiftGithubDate,
} from '@altstack/shared/lib/github-stars'
import { listLicensesOutputSchema } from '@altstack/shared/schemas/license'
import { searchSortSchema } from '@altstack/shared/schemas/project'

const client = createRouterClient(routers, { context: { db, auth: null } })
const token = 'zqxlicensecatalogue'
const fixtures = [
	{
		id: randomUUID(),
		name: 'Alpha',
		license: 'MIT',
		stars: 100,
		forks: 1,
		commit: new Date('2024-01-01'),
		age: new Date('2018-01-01'),
	},
	{
		id: randomUUID(),
		name: 'Bravo',
		license: 'MIT',
		stars: 100,
		forks: 5,
		commit: new Date('2026-01-01'),
		age: new Date('2020-01-01'),
	},
	{
		id: randomUUID(),
		name: 'Charlie',
		license: 'Apache-2.0',
		stars: 900,
		forks: 3,
		commit: new Date('2025-01-01'),
		age: new Date('2019-01-01'),
	},
	{
		id: randomUUID(),
		name: 'Delta',
		license: null,
		stars: 1,
		forks: 0,
		commit: null,
		age: null,
	},
	{
		id: randomUUID(),
		name: 'Echo',
		license: 'NOASSERTION',
		stars: 2,
		forks: 0,
		commit: null,
		age: null,
	},
]
const privateIds: Array<string> = []
const fetchRepo = vi
	.spyOn(octokit.rest.repos, 'get')
	.mockRejectedValue(new Error('Public reads must not call GitHub'))

beforeAll(async () => {
	for (const [index, item] of fixtures.entries()) {
		await db.insert(project).values({
			id: item.id,
			name: item.name,
			slug: `${token}-${index}`,
			repositoryUrl: `https://github.com/${token}/${index}`,
			status: 'published',
			tagline: token,
			description: token,
			logo: 'test-fixtures/baseline.svg',
			createdAt: new Date(`2026-01-0${index + 1}`),
		})
		await db.insert(githubRepository).values({
			projectId: item.id,
			owner: token,
			repo: String(index),
			stars: item.stars,
			forks: item.forks,
			fetchedAt: new Date(),
			lastCommitAt: item.commit,
			repositoryCreatedAt: item.age,
			archived: index === 0,
			...normalizeGithubLicense(
				item.license
					? {
							key: item.license.toLowerCase(),
							name: `${item.license} License`,
							spdx_id: item.license,
						}
					: null
			),
		})
	}
	for (const status of ['draft', 'rejected', 'removed'] as const) {
		const id = randomUUID()
		privateIds.push(id)
		await db.insert(project).values({
			id,
			name: 'Private license title',
			slug: `${token}-${status}`,
			status,
			repositoryUrl: `https://github.com/${token}/${status}`,
			tagline: token,
			description: token,
		})
		await db.insert(githubRepository).values({
			projectId: id,
			owner: token,
			repo: status,
			stars: 999999,
			fetchedAt: new Date(),
			...normalizeGithubLicense({
				key: 'private',
				name: 'Private license',
				spdx_id: 'Private-Only',
			}),
		})
	}
	const today = githubSnapshotDate(new Date())
	for (const [index, points] of [
		[
			0,
			[
				[-7, 10],
				[0, 60],
			],
		],
		[
			1,
			[
				[-7, 90],
				[0, 100],
			],
		],
		[
			2,
			[
				[-8, 0],
				[0, 900],
			],
		],
		[
			3,
			[
				[-3, 9],
				[0, 1],
			],
		],
	] as const) {
		await db.insert(githubStarHistory).values(
			points.map(([days, stars]) => {
				return {
					projectId: fixtures[index]!.id,
					snapshotDate: shiftGithubDate(today, days),
					stars,
					observedAt: new Date(),
				}
			})
		)
	}
})
afterAll(async () => {
	await db
		.delete(project)
		.where(
			inArray(project.id, [...fixtures.map((item) => item.id), ...privateIds])
		)
	fetchRepo.mockRestore()
})

describe('public license catalogue', () => {
	it('does not request GitHub on public reads', async () => {
		await client.license.list({})
		await client.project.search({ query: { q: token, license: 'mit' } })
		expect(fetchRepo).not.toHaveBeenCalled()
	})
	it('counts only published visible rows; custom/null licenses share the honest unknown bucket', async () => {
		const { licenses } = await client.license.list({})
		expect(licenses.find((item) => item.slug === 'mit')).toMatchObject({
			identifier: 'MIT',
			projectCount: 2,
		})
		expect(
			licenses.find((item) => item.slug === 'unknown')!.projectCount
		).toBeGreaterThanOrEqual(2)
		expect(licenses.some((item) => item.slug === 'private-only')).toBe(false)
		await expect(
			client.license.getBySlug({ params: { slug: 'private-only' } })
		).rejects.toMatchObject({ code: 'NOT_FOUND' })
		await expect(
			client.license.getBySlug({ params: { slug: 'missing-license' } })
		).rejects.toMatchObject({ code: 'NOT_FOUND' })
		expect(
			(await client.license.getBySlug({ params: { slug: 'Apache-2.0' } }))
				.license.projectCount
		).toBe(1)
	})
	it('scopes text search, counts, pagination, and unknown filters to published projects', async () => {
		const result = await client.project.search({
			query: { q: token, license: 'mit', limit: 1, sort: 'name' },
		})
		expect(result.pagination).toMatchObject({
			totalItems: 2,
			totalPages: 2,
			hasNextPage: true,
		})
		expect(result.projects.map((item) => item.name)).toEqual(['Alpha'])
		expect(result.projects[0]!.github).toMatchObject({
			licenseSlug: 'mit',
			licenseSpdxId: 'MIT',
			licenseUrl: 'https://spdx.org/licenses/MIT.html',
			archived: true,
			lastCommitAt: fixtures[0]!.commit,
		})
		expect(
			(
				await client.project.search({
					query: { q: token, license: 'unknown', sort: 'name' },
				})
			).projects.map((item) => item.name)
		).toEqual(['Delta', 'Echo'])
		expect(
			(
				await client.project.search({
					query: { q: 'absentuniquetoken', license: 'mit' },
				})
			).pagination.totalItems
		).toBe(0)
		expect(
			(await client.project.search({ query: { license: 'private-only' } }))
				.projects
		).toEqual([])
		expect(
			(await client.project.search({ query: { license: 'mit', page: 999 } }))
				.projects
		).toEqual([])
	})
	it('exposes public REST contracts and detail metadata without upstream reads', async () => {
		const response = await openApiHandler.handle(
			new Request('http://localhost/licenses', { method: 'QUERY' }),
			{ context: { db, auth: null } }
		)
		expect(response.response?.status).toBe(200)
		const body = listLicensesOutputSchema.parse(await response.response!.json())
		expect(
			body.licenses.some(
				(item: { slug: string }) => item.slug === 'private-only'
			)
		).toBe(false)
		const detail = await client.project.getBySlug({
			params: { slug: `${token}-0` },
		})
		expect(detail.github).toMatchObject({ licenseSlug: 'mit', archived: true })
	})
	it('implements all ten deterministic sorts, including nulls last and observed seven-day growth', async () => {
		const idsDescending = (
			a: (typeof fixtures)[number],
			b: (typeof fixtures)[number]
		) => b.id.localeCompare(a.id)
		const dates =
			(key: 'commit' | 'age', direction: 1 | -1) =>
			(a: (typeof fixtures)[number], b: (typeof fixtures)[number]) =>
				a[key] === null
					? b[key] === null
						? direction === 1
							? a.id.localeCompare(b.id)
							: idsDescending(a, b)
						: 1
					: b[key] === null
						? -1
						: direction * (a[key].getTime() - b[key].getTime())
		const expected = {
			recommended: fixtures.toReversed(),
			oldest: fixtures,
			newest: fixtures.toReversed(),
			name: fixtures,
			'name-desc': fixtures.toReversed(),
			'most-stars': fixtures.toSorted(
				(a, b) => b.stars - a.stars || idsDescending(a, b)
			),
			'most-popular': fixtures.toSorted(
				(a, b) => b.stars - a.stars || idsDescending(a, b)
			),
			'most-forks': fixtures.toSorted(
				(a, b) => b.forks - a.forks || idsDescending(a, b)
			),
			'last-commit': fixtures.toSorted(dates('commit', -1)),
			'repository-age': fixtures.toSorted(dates('age', 1)),
			trending: [
				fixtures[0]!,
				fixtures[1]!,
				fixtures[3]!,
				...[fixtures[2]!, fixtures[4]!].toSorted(idsDescending),
			],
		}
		for (const sort of searchSortSchema.options) {
			const result = await client.project.search({ query: { q: token, sort } })
			expect(result.projects.map((item) => item.id)).toEqual(
				expected[sort].map((item) => item.id)
			)
			const first = await client.project.search({
				query: { q: token, sort, limit: 2 },
			})
			const second = await client.project.search({
				query: { q: token, sort, limit: 2, page: 2 },
			})
			expect(
				[...first.projects, ...second.projects].map((item) => item.id)
			).toEqual(expected[sort].slice(0, 4).map((item) => item.id))
		}
	})
})
