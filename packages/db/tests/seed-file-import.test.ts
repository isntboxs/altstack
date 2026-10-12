import type { SeedGithubClient } from '../src/seed-file-github'
import { eq, sql } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from 'vite-plus/test'

import {
	category,
	categoryPath,
	githubRepository,
	githubStarHistory,
	project,
	projectCategory,
} from '@altstack/db/schemas'

import { importSeedFiles } from '../src/seed-file-import'
import { parseSeedFiles } from '../src/seed-file-parser'
import { connectTestPostgres } from './helpers/postgres'

let postgres: Awaited<ReturnType<typeof connectTestPostgres>> | undefined
let scope: Awaited<ReturnType<NonNullable<typeof postgres>['createSchema']>>
let currentScope: typeof scope | undefined
const root = fileURLToPath(new URL('../../../', import.meta.url))
const migrationsFolder = fileURLToPath(
	new URL('../src/migrations', import.meta.url)
)
const tool = {
	name: 'Example Tool',
	slug: 'example-tool',
	repositoryUrl: 'test-owner/example-tool',
}
const cat = (slug: string, parentSlug?: string) => {
	return {
		name: `Category ${slug}`,
		slug,
		description: `Description ${slug}`,
		...(parentSlug ? { parentSlug } : {}),
	}
}
const input = (
	projects: Array<unknown> = [],
	categories: Array<unknown> = []
) =>
	parseSeedFiles(
		{ file: 'projects.json', text: JSON.stringify(projects) },
		{ file: 'categories.json', text: JSON.stringify(categories) }
	)
function github(
	repositoryUrl = 'https://github.com/test-owner/example-tool'
): SeedGithubClient {
	return {
		statistics: vi.fn().mockResolvedValue({
			repositoryUrl,
			githubRepositoryId: 123,
			stars: 321,
			forks: 12,
			repositoryCreatedAt: new Date('2020-01-01'),
			lastCommitAt: new Date('2026-01-01'),
			latestReleaseTag: 'v1.0.0',
		}),
		readme: vi.fn().mockResolvedValue('# GitHub README'),
	}
}

beforeAll(async () => {
	postgres = await connectTestPostgres()
})
beforeEach(async () => {
	currentScope = undefined
	if (!postgres) throw new Error('Missing scoped test database')
	scope = await postgres.createSchema()
	currentScope = scope
	await migrate(scope.db, {
		migrationsFolder,
		migrationsSchema: scope.migrationsSchema,
	})
}, 60_000)
afterEach(async () => {
	vi.restoreAllMocks()
	await currentScope?.close()
}, 60_000)
afterAll(async () => {
	await postgres?.close()
}, 60_000)

async function state() {
	const [categories, paths, projects, repositories, relations, history] =
		await Promise.all([
			scope.db.select().from(category).orderBy(category.slug),
			scope.db.select().from(categoryPath).orderBy(categoryPath.path),
			scope.db.select().from(project).orderBy(project.slug),
			scope.db
				.select()
				.from(githubRepository)
				.orderBy(githubRepository.projectId),
			scope.db
				.select()
				.from(projectCategory)
				.orderBy(projectCategory.projectId, projectCategory.categoryId),
			scope.db.select().from(githubStarHistory),
		])
	return { categories, paths, projects, repositories, relations, history }
}

describe('transactional file seeding in disposable PostgreSQL schemas', () => {
	it('resolves unordered hierarchy, creates leaf links and offline GitHub placeholders without network or synthetic history', async () => {
		const network = vi
			.spyOn(globalThis, 'fetch')
			.mockRejectedValue(new Error('Network forbidden'))
		const result = await importSeedFiles(
			scope.db,
			input(
				[{ ...tool, categorySlugs: ['leaf'] }],
				[cat('leaf', 'middle'), cat('root'), cat('middle', 'root')]
			)
		)
		expect(result).toMatchObject({
			categories: { created: 3, skipped: 0 },
			paths: { created: 3 },
			projects: { created: 1 },
			githubRepositories: { created: 1 },
			relations: { created: 1 },
			warnings: [],
		})
		const saved = await state()
		expect(saved.paths.map((row) => row.path)).toEqual([
			'root',
			'root/middle',
			'root/middle/leaf',
		])
		expect(saved.projects[0]).toMatchObject({
			status: 'draft',
			repositoryUrl: 'https://github.com/test-owner/example-tool',
			content: null,
		})
		expect(saved.repositories[0]).toMatchObject({
			owner: 'test-owner',
			repo: 'example-tool',
			stars: 0,
			forks: 0,
			fetchedAt: new Date(0),
			githubRepositoryId: null,
			repositoryCreatedAt: null,
			lastCommitAt: null,
			latestReleaseTag: null,
			metadataFetchedAt: null,
		})
		expect(saved.history).toEqual([])
		expect(network).not.toHaveBeenCalled()
	})
	it('skips existing rows and relations without changing IDs, timestamps, content or historical paths', async () => {
		await importSeedFiles(
			scope.db,
			input(
				[{ ...tool, content: 'Original', categorySlugs: ['leaf'] }],
				[cat('root'), cat('leaf', 'root')]
			)
		)
		const [leaf] = await scope.db
			.select()
			.from(category)
			.where(eq(category.slug, 'leaf'))
		if (!leaf) throw new Error('Missing leaf')
		await scope.db
			.insert(categoryPath)
			.values({ path: 'old-leaf', categoryId: leaf.id })
		const before = await state()
		const client = github()
		const result = await importSeedFiles(
			scope.db,
			input(
				[
					{
						...tool,
						name: 'Changed',
						content: 'Changed',
						categorySlugs: ['unknown-ignored'],
					},
				],
				[{ ...cat('leaf', 'nonexistent-ignored'), name: 'Changed' }]
			),
			{ github: client }
		)
		expect(result).toMatchObject({
			categories: { created: 0, skipped: 1 },
			paths: { created: 0, skipped: 2 },
			projects: { created: 0, skipped: 1 },
			githubRepositories: { created: 0, skipped: 1 },
			relations: { created: 0, skipped: 1 },
		})
		expect(await state()).toEqual(before)
		expect(client.statistics).not.toHaveBeenCalled()
		expect(client.readme).not.toHaveBeenCalled()
	})
	it('resolves parents from actual database ancestry and preserves skipped parent definitions', async () => {
		await importSeedFiles(
			scope.db,
			input([], [cat('root'), cat('existing', 'root')])
		)
		await importSeedFiles(
			scope.db,
			input([], [cat('leaf', 'existing'), cat('existing', 'ignored-parent')])
		)
		expect((await state()).paths.map((row) => row.path)).toContain(
			'root/existing/leaf'
		)
	})
	it.each([
		[
			'depth',
			[
				cat('one'),
				cat('two', 'one'),
				cat('three', 'two'),
				cat('four', 'three'),
			],
			'tiga tingkat',
		],
		['cycle', [cat('one', 'two'), cat('two', 'one')], 'Siklus'],
		['self cycle', [cat('one', 'one')], 'Siklus'],
		['unknown parent', [cat('child', 'absent')], 'Parent tidak dikenal'],
	])('rejects %s with no partial writes', async (_name, categories, reason) => {
		const before = await state()
		await expect(
			importSeedFiles(scope.db, input([tool], categories))
		).rejects.toThrow(reason)
		expect(await state()).toEqual(before)
	})
	it.each(['root', 'missing'])(
		'requires referenced category %s to exist and be a leaf',
		async (slug) => {
			const before = await state()
			await expect(
				importSeedFiles(
					scope.db,
					input(
						[{ ...tool, categorySlugs: [slug] }],
						[cat('root'), cat('leaf', 'root')]
					)
				)
			).rejects.toThrow(/categorySlugs/)
			expect(await state()).toEqual(before)
		}
	)
	it('publishes valid projects with 1–3 leaf assignments', async () => {
		await importSeedFiles(
			scope.db,
			input(
				[
					{
						...tool,
						status: 'published',
						tagline: 'Example',
						description: 'Example tool',
						logo: 'https://example.com/logo.svg',
						categorySlugs: ['first', 'second'],
					},
				],
				[cat('first'), cat('second')]
			)
		)
		expect((await state()).projects[0]?.status).toBe('published')
		expect((await state()).relations).toHaveLength(2)
	})
	it('rejects adding a child to a parent with direct draft assignments', async () => {
		await importSeedFiles(
			scope.db,
			input([{ ...tool, categorySlugs: ['parent'] }], [cat('parent')])
		)
		const before = await state()
		await expect(
			importSeedFiles(scope.db, input([], [cat('child', 'parent')]))
		).rejects.toThrow('project langsung')
		expect(await state()).toEqual(before)
	})
	it('rejects a historically reserved path and rolls back the whole import', async () => {
		await importSeedFiles(scope.db, input([], [cat('owner')]))
		const [owner] = await scope.db.select().from(category)
		if (!owner) throw new Error('Missing owner')
		await scope.db
			.insert(categoryPath)
			.values({ categoryId: owner.id, path: 'root/leaf' })
		const before = await state()
		await expect(
			importSeedFiles(
				scope.db,
				input([tool], [cat('root'), cat('leaf', 'root')])
			)
		).rejects.toThrow('Path historis')
		expect(await state()).toEqual(before)
	})
	it('recognizes legacy canonical repository variants and rejects split slug/repository identities', async () => {
		await importSeedFiles(
			scope.db,
			input([
				tool,
				{ ...tool, slug: 'second', repositoryUrl: 'test-owner/second' },
			])
		)
		await scope.db
			.update(project)
			.set({
				repositoryUrl: 'http://www.GitHub.com/TEST-OWNER/EXAMPLE-TOOL.git/',
			})
			.where(eq(project.slug, tool.slug))
		const before = await state()
		expect(
			(await importSeedFiles(scope.db, input([{ ...tool, slug: 'renamed' }])))
				.projects.skipped
		).toBe(1)
		await expect(
			importSeedFiles(
				scope.db,
				input([{ ...tool, repositoryUrl: 'test-owner/second' }])
			)
		).rejects.toThrow('dua project berbeda')
		expect(await state()).toEqual(before)
	})
	it('does not backfill metadata or relationships for existing projects', async () => {
		await scope.db.insert(project).values({
			...tool,
			repositoryUrl: 'https://github.com/test-owner/example-tool',
			status: 'draft',
		})
		const before = await state()
		const result = await importSeedFiles(
			scope.db,
			input([{ ...tool, categorySlugs: ['absent'] }])
		)
		expect(result.projects.skipped).toBe(1)
		expect(await state()).toEqual(before)
	})
	it('rolls back categories, paths, projects, metadata and relations after a late database error', async () => {
		await scope.db.execute(
			sql`CREATE FUNCTION reject_second() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.slug = 'second' THEN RAISE EXCEPTION 'late failure'; END IF; RETURN NEW; END $$`
		)
		await scope.db.execute(
			sql`CREATE TRIGGER reject_second BEFORE INSERT ON projects FOR EACH ROW EXECUTE FUNCTION reject_second()`
		)
		const before = await state()
		await expect(
			importSeedFiles(
				scope.db,
				input(
					[
						{ ...tool, categorySlugs: ['leaf'] },
						{ ...tool, slug: 'second', repositoryUrl: 'test-owner/second' },
					],
					[cat('leaf')]
				)
			)
		).rejects.toThrow(/projects.json: index 1: \$record: late failure/)
		expect(await state()).toEqual(before)
	})
	it('dry-run validates the complete plan without any writes, with or without GitHub', async () => {
		const before = await state()
		const data = input([{ ...tool, categorySlugs: ['leaf'] }], [cat('leaf')])
		const client = github()
		for (const provider of [undefined, client]) {
			const result = await importSeedFiles(scope.db, data, {
				dryRun: true,
				github: provider,
			})
			expect(result).toMatchObject({
				dryRun: true,
				projects: { created: 1 },
				categories: { created: 1 },
				relations: { created: 1 },
			})
			expect(await state()).toEqual(before)
		}
		expect(client.statistics).toHaveBeenCalledOnce()
		expect(data.projects[0]?.value.content).toBeUndefined()
	})
	it('fetches GitHub before writes, keeps file content and uses normalized renamed identity', async () => {
		const client = github('http://www.github.com/RENAMED/TOOL.git/')
		client.statistics = vi.fn(async () => {
			expect((await state()).categories).toEqual([])
			return {
				repositoryUrl: 'http://www.github.com/RENAMED/TOOL.git/',
				githubRepositoryId: 123,
				stars: 321,
				forks: 12,
				repositoryCreatedAt: new Date('2020-01-01'),
				lastCommitAt: null,
				latestReleaseTag: null,
			}
		})
		await importSeedFiles(
			scope.db,
			input(
				[{ ...tool, content: '# File content', categorySlugs: ['leaf'] }],
				[cat('leaf')]
			),
			{ github: client }
		)
		const saved = await state()
		expect(saved.projects[0]).toMatchObject({
			content: '# File content',
			repositoryUrl: 'https://github.com/renamed/tool',
		})
		expect(saved.repositories[0]).toMatchObject({
			owner: 'renamed',
			repo: 'tool',
			stars: 321,
			forks: 12,
			githubRepositoryId: 123,
			repositoryCreatedAt: new Date('2020-01-01'),
		})
		expect(saved.repositories[0]?.fetchedAt.getTime()).toBeGreaterThan(0)
		expect(saved.repositories[0]?.metadataFetchedAt).toEqual(
			saved.repositories[0]?.fetchedAt
		)
		expect(client.readme).toHaveBeenCalledWith('renamed', 'tool')
		expect(saved.history).toEqual([])
	})
	it('imports README when content is absent and warns when README is unavailable', async () => {
		await importSeedFiles(scope.db, input([tool]), { github: github() })
		expect((await state()).projects[0]?.content).toBe('# GitHub README')
		const client = github('https://github.com/test-owner/second')
		client.statistics = vi.fn().mockResolvedValue({
			...(await github().statistics('a', 'b')),
			repositoryUrl: 'https://github.com/test-owner/second',
			githubRepositoryId: 456,
		})
		client.readme = vi.fn().mockResolvedValue(null)
		const result = await importSeedFiles(
			scope.db,
			input([{ ...tool, slug: 'second', repositoryUrl: 'test-owner/second' }]),
			{ github: client }
		)
		expect(result.warnings[0]).toMatch(
			/projects.json: index 0: content: README tidak tersedia/
		)
	})
	it('aborts statistics failures before any writes', async () => {
		const client = github()
		client.statistics = vi
			.fn()
			.mockRejectedValue(new Error('statistics unavailable'))
		const before = await state()
		await expect(
			importSeedFiles(scope.db, input([tool], [cat('leaf')]), {
				github: client,
			})
		).rejects.toThrow(/Statistik GitHub gagal: statistics unavailable/)
		expect(await state()).toEqual(before)
		expect(client.readme).not.toHaveBeenCalled()
	})
	it('rejects duplicate identities after GitHub normalization before writing', async () => {
		const client = github()
		const before = await state()
		await expect(
			importSeedFiles(
				scope.db,
				input(
					[
						tool,
						{ ...tool, slug: 'second', repositoryUrl: 'test-owner/second' },
					],
					[cat('leaf')]
				),
				{ github: client }
			)
		).rejects.toThrow('Identitas duplikat')
		expect(await state()).toEqual(before)
	})
	it('rechecks database conflicts after network work and skips a resolved existing repository', async () => {
		await importSeedFiles(
			scope.db,
			input([
				{ ...tool, slug: 'existing', repositoryUrl: 'test-owner/existing' },
			])
		)
		const before = await state()
		const client = github('https://github.com/test-owner/existing')
		expect(
			(await importSeedFiles(scope.db, input([tool]), { github: client }))
				.projects.skipped
		).toBe(1)
		expect(await state()).toEqual(before)
	})
	it('revalidates hierarchy changes made while GitHub is being fetched', async () => {
		await importSeedFiles(scope.db, input([], [cat('leaf')]))
		const client = github()
		client.readme = vi.fn(async () => {
			await importSeedFiles(scope.db, input([], [cat('child', 'leaf')]))
			return '# README'
		})
		await expect(
			importSeedFiles(scope.db, input([{ ...tool, categorySlugs: ['leaf'] }]), {
				github: client,
			})
		).rejects.toThrow('harus berupa daun')
		expect((await state()).projects).toEqual([])
	})
	it('holds the API advisory lock through planning and commit, including dry-run', async () => {
		const observer = await scope.pool.connect()
		try {
			const database: Pick<typeof scope.db, 'transaction'> = {
				transaction: async <T>(
					callback: (
						tx: Parameters<Parameters<typeof scope.db.transaction>[0]>[0]
					) => Promise<T>
				) =>
					scope.db.transaction(async (tx) => {
						const result = await callback(tx)
						const lock = await observer.query<{ locked: boolean }>(
							"SELECT pg_try_advisory_xact_lock(hashtext('altstack.category-integrity'), hashtext(current_schema())) AS locked"
						)
						expect(lock.rows[0]?.locked).toBe(false)
						return result
					}),
			}

			await importSeedFiles(database, input([tool]), { dryRun: true })
			const lock = await observer.query<{ locked: boolean }>(
				"SELECT pg_try_advisory_xact_lock(hashtext('altstack.category-integrity'), hashtext(current_schema())) AS locked"
			)
			expect(lock.rows[0]?.locked).toBe(true)
		} finally {
			observer.release()
		}
	})
	it('runs root and database package scripts with caller-relative paths and nonzero failures', async () => {
		const folder = await mkdtemp(join(tmpdir(), 'seed-cli-'))
		const execute = promisify(execFile)
		try {
			const projects = join(folder, 'projects.json')
			await writeFile(projects, JSON.stringify([tool]))
			const command = (cwd: string, extra: Array<string>) =>
				execute(
					'vp',
					[
						'run',
						'db:seed',
						'--',
						'--projects',
						relative(cwd, projects),
						...extra,
					],
					{
						cwd,
						env: { PATH: process.env.PATH, DATABASE_URL: scope.url },
						timeout: 20_000,
					}
				)
			const dry = await command(root, ['--dry-run'])
			expect(dry.stdout).toContain('Dry-run')
			expect((await state()).projects).toEqual([])
			const saved = await command(root, [])
			expect(saved.stdout).toContain('Project: dibuat=1, dilewati=0')
			const rerun = await command(join(root, 'packages/db'), [])
			expect(rerun.stdout).toContain('Project: dibuat=0, dilewati=1')
			await writeFile(projects, '[{"name":"invalid"}]')
			await expect(command(root, [])).rejects.toMatchObject({ code: 1 })
		} finally {
			await rm(folder, { recursive: true, force: true })
		}
	}, 60_000)
})
