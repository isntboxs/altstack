import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { cp, mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vite-plus/test'

import { githubRepository, project } from '@altstack/db/schemas'

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
	baselineFolder = await mkdtemp(join(tmpdir(), 'altstack-github-migration-'))
	for (const name of await readdir(migrationsFolder)) {
		if (!name.endsWith('_github-statistics-metadata')) {
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
			name: 'Legacy tool',
			slug: 'legacy-tool',
			repositoryUrl: 'https://github.com/legacy/tool',
			status: 'draft',
		})
		.returning()
	if (!legacy) throw new Error('Missing legacy project')
	projectId = legacy.id
	await scope.pool.query(
		`INSERT INTO github_repositories (project_id, owner, repo, stars, forks, fetched_at)
		VALUES ($1, 'legacy', 'tool', 123, 45, '2024-01-01')`,
		[projectId]
	)
}, 60_000)
afterAll(async () => {
	await scope.close()
	await postgres.close()
	await rm(baselineFolder, { recursive: true, force: true })
}, 60_000)

describe('nullable GitHub metadata migration', () => {
	it('upgrades existing rows without changing identity or statistics, and can be run again', async () => {
		const options = {
			migrationsFolder,
			migrationsSchema: scope.migrationsSchema,
		}
		await migrate(scope.db, options)
		await migrate(scope.db, options)
		const [row] = await scope.db
			.select()
			.from(githubRepository)
			.where(eq(githubRepository.projectId, projectId))
		expect(row).toMatchObject({
			owner: 'legacy',
			repo: 'tool',
			stars: 123,
			forks: 45,
			lastCommitAt: null,
			repositoryCreatedAt: null,
			latestReleaseTag: null,
			metadataFetchedAt: null,
		})
	})
})
