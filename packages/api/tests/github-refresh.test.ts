import { createRouterClient, ORPCError } from '@orpc/server'
import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { RequestError } from 'octokit'
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
import { octokit } from '@altstack/api/github'
import {
	emptyGithubMetadata,
	refreshProjectGithub,
} from '@altstack/api/github-refresh'
import {
	GITHUB_REFRESH_LOCK,
	runGithubRefreshBatch,
} from '@altstack/api/github-refresh-batch'
import { openApiHandler } from '@altstack/api/handler'
import { routers } from '@altstack/api/routers'

import {
	category,
	githubRepository,
	project,
	projectCategory,
	user,
} from '@altstack/db/schemas'
import { seedTaxonomy } from '@altstack/db/seed-taxonomy'

import { connectTestPostgres } from '../../db/tests/helpers/postgres'

let postgres: Awaited<ReturnType<typeof connectTestPostgres>>
let scope: Awaited<ReturnType<typeof postgres.createSchema>>
let adminId: string
type RepoResponse = Awaited<ReturnType<typeof octokit.rest.repos.get>>
type CommitResponse = Awaited<ReturnType<typeof octokit.rest.repos.getCommit>>
type ReleaseResponse = Awaited<
	ReturnType<typeof octokit.rest.repos.getLatestRelease>
>
const oldTime = new Date('2024-01-01T00:00:00Z')

function context(role: string | null = 'admin'): ORPCContext {
	return {
		db: scope.db,
		auth: role
			? ({ user: { id: adminId, role } } as ORPCContext['auth'])
			: null,
	}
}
function client(role: string | null = 'admin') {
	return createRouterClient(routers, { context: context(role) })
}
function repository(owner = 'old', repo = 'repo') {
	return {
		data: {
			private: false,
			owner: { login: owner },
			name: repo,
			stargazers_count: 90,
			forks_count: 9,
			created_at: '2020-02-03T04:05:06Z',
			default_branch: 'main',
		},
	} as unknown as RepoResponse
}
async function fixture(
	status: 'draft' | 'published' | 'rejected' | 'removed' = 'published',
	id = randomUUID()
) {
	const [inserted] = await scope.db
		.insert(project)
		.values({
			id,
			name: `Tool ${id}`,
			slug: `tool-${id}`,
			repositoryUrl: `https://github.com/old/repo-${id}`,
			status,
			tagline: 'Useful tool',
			description: 'Useful tool description',
			logo: 'projects/test/logo.png',
		})
		.returning()
	if (!inserted) throw new Error('Missing fixture')
	await scope.db.insert(githubRepository).values({
		projectId: id,
		owner: 'old',
		repo: `repo-${id}`,
		stars: 5,
		forks: 2,
		fetchedAt: oldTime,
		metadataFetchedAt: oldTime,
		lastCommitAt: oldTime,
		repositoryCreatedAt: oldTime,
		latestReleaseTag: 'v1',
	})
	const [leaf] = await scope.db
		.select()
		.from(category)
		.where(eq(category.slug, 'backend'))
	if (!leaf) throw new Error('Missing taxonomy')
	await scope.db
		.insert(projectCategory)
		.values({ projectId: id, categoryId: leaf.id })
	return inserted
}
async function stored(id: string) {
	const [row] = await scope.db
		.select()
		.from(githubRepository)
		.where(eq(githubRepository.projectId, id))
	return row
}
async function changeRepository(id: string, owner: string, repo: string) {
	await scope.db.transaction(async (tx) => {
		await tx
			.update(project)
			.set({ repositoryUrl: `https://github.com/${owner}/${repo}` })
			.where(eq(project.id, id))
		await tx
			.update(githubRepository)
			.set({ owner, repo, ...emptyGithubMetadata })
			.where(eq(githubRepository.projectId, id))
	})
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
	await seedTaxonomy(scope.db)
	const [admin] = await scope.db
		.insert(user)
		.values({
			name: 'Refresh admin',
			email: `${randomUUID()}@refresh.test`,
			emailVerified: true,
			role: 'admin',
		})
		.returning()
	if (!admin) throw new Error('Missing admin')
	adminId = admin.id
}, 60_000)
beforeEach(async () => {
	await scope.db.delete(project)
	vi.restoreAllMocks()
	vi.spyOn(octokit.rest.repos, 'get').mockImplementation((parameters) =>
		Promise.resolve(repository(parameters?.owner, parameters?.repo))
	)
	vi.spyOn(octokit.rest.repos, 'getCommit').mockResolvedValue({
		data: { commit: { committer: { date: '2026-10-09T00:00:00Z' } } },
	} as unknown as CommitResponse)
	vi.spyOn(octokit.rest.repos, 'getLatestRelease').mockResolvedValue({
		data: { tag_name: 'v2' },
	} as unknown as ReleaseResponse)
})
afterAll(async () => {
	vi.restoreAllMocks()
	await scope.close()
	await postgres.close()
}, 60_000)

describe('admin refresh endpoint and atomic storage', () => {
	it.each([
		[null, 'UNAUTHORIZED'],
		['user', 'FORBIDDEN'],
	])('denies %s before GitHub access', async (role, code) => {
		await expect(
			client(role).admin.project.githubRefresh({ params: { id: randomUUID() } })
		).rejects.toMatchObject({ code })
		expect(octokit.rest.repos.get).not.toHaveBeenCalled()
	})
	it('returns NOT_FOUND for unknown IDs', async () => {
		await expect(
			client().admin.project.githubRefresh({ params: { id: randomUUID() } })
		).rejects.toMatchObject({ code: 'NOT_FOUND' })
		expect(octokit.rest.repos.get).not.toHaveBeenCalled()
	})
	it('returns the persisted complete snapshot via POST, public/admin detail, and compact lists', async () => {
		const item = await fixture()
		const before = await stored(item.id)
		const result = await openApiHandler.handle(
			new Request(`http://localhost/admin/projects/${item.id}/github-refresh`, {
				method: 'POST',
			}),
			{ context: context() }
		)
		expect(result.response?.status).toBe(200)
		expect(await result.response?.json()).toMatchObject({
			repositoryUrl: item.repositoryUrl,
			github: {
				stars: 90,
				forks: 9,
				latestReleaseTag: 'v2',
				lastCommitAt: '2026-10-09T00:00:00.000Z',
			},
		})
		const row = await stored(item.id)
		expect(row?.fetchedAt).toEqual(row?.metadataFetchedAt)
		expect(row?.fetchedAt.getTime()).toBeGreaterThan(
			before?.fetchedAt.getTime() ?? 0
		)
		expect(row?.repositoryCreatedAt).toEqual(new Date('2020-02-03T04:05:06Z'))
		const publicDetail = await client(null).project.getBySlug({
			params: { slug: item.slug },
		})
		const adminDetail = await client().admin.project.getById({
			params: { id: item.id },
		})
		expect(publicDetail.github).toEqual(adminDetail.github)
		expect(publicDetail.github).toMatchObject({
			lastCommitAt: row?.lastCommitAt,
			metadataFetchedAt: row?.metadataFetchedAt,
		})
		expect(
			(await client(null).project.search({ query: {} })).projects[0]?.github
		).not.toHaveProperty('lastCommitAt')
		expect(
			(await client().admin.project.list({ query: {} })).projects[0]?.github
		).not.toHaveProperty('metadataFetchedAt')
		expect(octokit.rest.repos.get).toHaveBeenCalledTimes(1)
	})
	it.each(['commit', 'release', 'deleted', 'rate-limit'])(
		'retains all old values and timestamps after %s failure',
		async (failure) => {
			const item = await fixture()
			const before = await stored(item.id)
			if (failure === 'commit') {
				vi.mocked(octokit.rest.repos.getCommit).mockRejectedValue(
					new Error('temporary')
				)
			}
			if (failure === 'release') {
				vi.mocked(octokit.rest.repos.getLatestRelease).mockRejectedValue(
					new Error('temporary')
				)
			}
			if (failure === 'deleted' || failure === 'rate-limit') {
				vi.mocked(octokit.rest.repos.get).mockRejectedValue(
					new RequestError('unavailable', failure === 'deleted' ? 404 : 429, {
						request: {
							method: 'GET',
							url: 'https://api.github.com/repos/old/repo',
							headers: {},
						},
					})
				)
			}
			await expect(
				client().admin.project.githubRefresh({ params: { id: item.id } })
			).rejects.toBeDefined()
			expect(await stored(item.id)).toEqual(before)
		}
	)
	it('updates a rename/transfer URL and github identity together', async () => {
		const item = await fixture()
		vi.mocked(octokit.rest.repos.get).mockResolvedValue(
			repository('NewOwner', 'NewRepo')
		)
		expect(
			await client().admin.project.githubRefresh({ params: { id: item.id } })
		).toMatchObject({
			repositoryUrl: 'https://github.com/newowner/newrepo',
			github: { owner: 'newowner', repo: 'newrepo' },
		})
		expect(
			(await scope.db.select().from(project).where(eq(project.id, item.id)))[0]
				?.repositoryUrl
		).toBe('https://github.com/newowner/newrepo')
	})
	it('retains old stats/identity if the canonical repository already belongs to another project', async () => {
		const item = await fixture()
		const other = await fixture()
		const before = await stored(item.id)
		vi.mocked(octokit.rest.repos.get).mockResolvedValue(
			repository('old', `repo-${other.id}`)
		)
		await expect(refreshProjectGithub(scope.db, item.id)).rejects.toMatchObject(
			{ code: 'CONFLICT' }
		)
		expect(await stored(item.id)).toEqual(before)
	})
	it.each([false, true])(
		'rejects an in-flight old snapshot after repository change (A→B→A: %s)',
		async (revert) => {
			const item = await fixture()
			vi.mocked(octokit.rest.repos.getLatestRelease).mockImplementationOnce(
				async () => {
					await changeRepository(item.id, 'new', 'repo')
					if (revert) await changeRepository(item.id, 'old', `repo-${item.id}`)
					return { data: { tag_name: 'v99-old' } } as unknown as ReleaseResponse
				}
			)
			await expect(
				client().admin.project.githubRefresh({ params: { id: item.id } })
			).rejects.toMatchObject({ code: 'CONFLICT' })
			expect(await stored(item.id)).toMatchObject({
				...emptyGithubMetadata,
				stars: 5,
				forks: 2,
			})
		}
	)
	it('enriches admin create, approval, and repo change, but metadata failure never fails the primary write', async () => {
		const created = await client().admin.project.create({
			body: {
				name: 'Created refresh tool',
				slug: 'created-refresh-tool',
				repositoryUrl: 'old/created',
				status: 'draft',
				categorySlugs: [],
			},
		})
		expect(created.github.latestReleaseTag).toBe('v2')
		const submitted = await fixture('draft')
		await scope.db
			.update(project)
			.set({ submitterId: adminId })
			.where(eq(project.id, submitted.id))
		const approved = await client().admin.project.update({
			params: { id: submitted.id },
			body: { status: 'published' },
		})
		expect(approved.github.latestReleaseTag).toBe('v2')
		vi.mocked(octokit.rest.repos.getLatestRelease).mockRejectedValue(
			new Error('temporary')
		)
		const changed = await client().admin.project.update({
			params: { id: submitted.id },
			body: { repositoryUrl: 'other/newrepo' },
		})
		expect(changed.repositoryUrl).toBe('https://github.com/other/newrepo')
		expect(changed.github).toMatchObject({
			owner: 'other',
			repo: 'newrepo',
			...emptyGithubMetadata,
		})
		const optional = await client().admin.project.create({
			body: {
				name: 'Optional enrich',
				slug: 'optional-enrich',
				repositoryUrl: 'old/optional',
				status: 'draft',
				categorySlugs: [],
			},
		})
		expect(optional.github).toMatchObject(emptyGithubMetadata)
		const anotherDraft = await fixture('draft')
		expect(
			(
				await client().admin.project.update({
					params: { id: anotherDraft.id },
					body: { status: 'published' },
				})
			).status
		).toBe('published')
	})
})

describe('daily batch', () => {
	it('selects every published project only and continues sequentially after individual errors', async () => {
		const first = await fixture(
			'published',
			'00000000-0000-4000-8000-000000000001'
		)
		const second = await fixture(
			'published',
			'00000000-0000-4000-8000-000000000002'
		)
		await fixture('draft')
		await fixture('rejected')
		await fixture('removed')
		const order: Array<string> = []
		const refresh = vi.fn<typeof refreshProjectGithub>(async (database, id) => {
			order.push(id)
			if (id === first.id) throw new ORPCError('NOT_FOUND')
			return refreshProjectGithub(database, id)
		})
		const log = vi.fn()
		expect(await runGithubRefreshBatch(scope.db, { refresh, log })).toEqual({
			selected: 2,
			succeeded: 1,
			failed: 1,
			skipped: false,
			rateLimited: false,
		})
		expect(order).toEqual([first.id, second.id])
		expect(log).toHaveBeenLastCalledWith({
			event: 'github-refresh-summary',
			selected: 2,
			succeeded: 1,
			failed: 1,
			skipped: false,
			rateLimited: false,
		})
	})
	it('stops immediately on rate limit and reports unprocessed projects', async () => {
		await fixture()
		await fixture()
		const refresh = vi
			.fn<typeof refreshProjectGithub>()
			.mockRejectedValue(new ORPCError('TOO_MANY_REQUESTS'))
		expect(await runGithubRefreshBatch(scope.db, { refresh })).toMatchObject({
			selected: 2,
			failed: 1,
			succeeded: 0,
			rateLimited: true,
		})
		expect(refresh).toHaveBeenCalledTimes(1)
	})
	it('skips overlapping jobs and releases the same advisory lock session on completion', async () => {
		await fixture()
		const refresh = vi
			.fn<typeof refreshProjectGithub>()
			.mockImplementation(async (database, id) => {
				expect(await runGithubRefreshBatch(database)).toMatchObject({
					skipped: true,
					succeeded: 0,
				})
				return refreshProjectGithub(database, id)
			})
		expect(await runGithubRefreshBatch(scope.db, { refresh })).toMatchObject({
			succeeded: 1,
			skipped: false,
		})
		const connection = await scope.pool.connect()
		try {
			const lock = await connection.query<{ locked: boolean }>(
				'SELECT pg_try_advisory_lock(hashtext($1), hashtext(current_database())) AS locked',
				[GITHUB_REFRESH_LOCK]
			)
			expect(lock.rows[0]?.locked).toBe(true)
		} finally {
			connection.release(true)
		}
	})
	it('releases the lock even after a fatal batch selection error', async () => {
		const select = vi.spyOn(scope.db, 'select').mockImplementationOnce(() => {
			throw new Error('Database unavailable')
		})
		await expect(runGithubRefreshBatch(scope.db)).rejects.toThrow(
			'Database unavailable'
		)
		select.mockRestore()
		expect(await runGithubRefreshBatch(scope.db)).toMatchObject({
			skipped: false,
		})
	})
})
