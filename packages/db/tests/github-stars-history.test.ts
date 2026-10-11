import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { randomUUID } from 'node:crypto'
import { cp, mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vite-plus/test'

import {
	githubRepository,
	githubStarHistory,
	project,
} from '@altstack/db/schemas'

import { connectTestPostgres } from './helpers/postgres'

const migrationsFolder = fileURLToPath(
	new URL('../src/migrations', import.meta.url)
)
let postgres: Awaited<ReturnType<typeof connectTestPostgres>>
let scope: Awaited<ReturnType<typeof postgres.createSchema>>
let baselineFolder: string
let projectId: string

beforeAll(async () => {
	postgres = await connectTestPostgres()
	scope = await postgres.createSchema()
	baselineFolder = await mkdtemp(join(tmpdir(), 'altstack-stars-migration-'))
	for (const name of await readdir(migrationsFolder)) {
		if (!name.endsWith('_github-stars-history')) {
			await cp(join(migrationsFolder, name), join(baselineFolder, name), {
				recursive: true,
			})
		}
	}
	await migrate(scope.db, {
		migrationsFolder: baselineFolder,
		migrationsSchema: scope.migrationsSchema,
	})
	const [legacy] = await scope.db
		.insert(project)
		.values({
			name: 'Legacy stars',
			slug: 'legacy-stars',
			repositoryUrl: 'https://github.com/legacy/stars',
			status: 'draft',
		})
		.returning()
	if (!legacy) throw new Error('Missing legacy project')
	projectId = legacy.id
	await scope.pool.query(
		"INSERT INTO github_repositories (project_id, owner, repo, stars, forks, fetched_at) VALUES ($1, 'legacy', 'stars', 123, 45, '2024-01-01')",
		[projectId]
	)
}, 60_000)
afterAll(async () => {
	await scope.close()
	await postgres.close()
	await rm(baselineFolder, { recursive: true, force: true })
}, 60_000)

describe('additive GitHub star-history migration', () => {
	it('preserves legacy statistics, leaves history empty, and can run twice', async () => {
		const options = {
			migrationsFolder,
			migrationsSchema: scope.migrationsSchema,
		}
		await migrate(scope.db, options)
		await migrate(scope.db, options)
		expect((await scope.db.select().from(githubRepository))[0]).toMatchObject({
			stars: 123,
			forks: 45,
			githubRepositoryId: null,
		})
		expect(await scope.db.select().from(githubStarHistory)).toEqual([])
	})
	it('enforces one daily sample, nonnegative stars, valid repository IDs, and FK ownership', async () => {
		const point = {
			projectId,
			snapshotDate: '2026-10-11',
			stars: 0,
			observedAt: new Date('2026-10-11T02:00:00+07:00'),
		}
		await scope.db.insert(githubStarHistory).values(point)
		await expect(
			scope.db.insert(githubStarHistory).values(point)
		).rejects.toMatchObject({ cause: { code: '23505' } })
		await expect(
			scope.db
				.insert(githubStarHistory)
				.values({ ...point, snapshotDate: '2026-10-12', stars: -1 })
		).rejects.toMatchObject({ cause: { code: '23514' } })
		await expect(
			scope.db
				.update(githubRepository)
				.set({ githubRepositoryId: 0 })
				.where(eq(githubRepository.projectId, projectId))
		).rejects.toMatchObject({ cause: { code: '23514' } })
		await expect(
			scope.db
				.insert(githubStarHistory)
				.values({ ...point, projectId: randomUUID() })
		).rejects.toMatchObject({ cause: { code: '23503' } })
	})
	it('deleting the GitHub row cascades its history', async () => {
		await scope.db
			.delete(githubRepository)
			.where(eq(githubRepository.projectId, projectId))
		expect(await scope.db.select().from(githubStarHistory)).toEqual([])
		expect(await scope.db.select().from(project)).toHaveLength(1)
	})
})
