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
	const migrations = (await readdir(migrationsFolder)).toSorted()
	const target = migrations.find((name) =>
		name.endsWith('_github-license-archived')
	)
	if (!target) throw new Error('Missing GitHub metadata migration')
	for (const name of migrations) {
		if (name < target) {
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
		`INSERT INTO github_repositories (project_id, owner, repo, github_repository_id, stars, forks, fetched_at, last_commit_at, repository_created_at, latest_release_tag, metadata_fetched_at)
		VALUES ($1, 'legacy', 'tool', 123, 123, 45, '2024-01-01', '2026-01-02Z', '2020-01-01Z', 'v1', '2026-01-03Z')`,
		[projectId]
	)
}, 60_000)
afterAll(async () => {
	await scope.close()
	await postgres.close()
	await rm(baselineFolder, { recursive: true, force: true })
}, 60_000)

describe('additive license and archived migration', () => {
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
			githubRepositoryId: 123,
			lastCommitAt: new Date('2026-01-02Z'),
			repositoryCreatedAt: new Date('2020-01-01Z'),
			latestReleaseTag: 'v1',
			metadataFetchedAt: new Date('2026-01-03Z'),
			licenseKey: null,
			licenseName: null,
			licenseSpdxId: null,
			licenseSlug: null,
			licenseUrl: null,
			archived: null,
		})
	})
})
