import { createRouterClient, ORPCError } from '@orpc/server'
import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { RequestError } from 'octokit'
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
	githubStarHistory,
	project,
	projectCategory,
	user,
} from '@altstack/db/schemas'
import { seedTaxonomy } from '@altstack/db/seed-taxonomy'

import {
	githubSnapshotDate,
	shiftGithubDate,
} from '@altstack/shared/lib/github-stars'

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
function repository(
	owner = 'old',
	repo = 'repo',
	id = owner === 'old' ? 123 : 456
) {
	return {
		data: {
			id,
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
afterEach(() => vi.useRealTimers())

async function history(id: string) {
	return scope.db
		.select()
		.from(githubStarHistory)
		.where(eq(githubStarHistory.projectId, id))
		.orderBy(githubStarHistory.snapshotDate)
}

describe('daily total-star snapshots', () => {
	it('upserts the last successful manual refresh and buckets midnight in WIB', async () => {
		const item = await fixture()
		vi.useFakeTimers({ toFake: ['Date'] })
		vi.setSystemTime(new Date('2026-10-10T16:59:59Z'))
		await refreshProjectGithub(scope.db, item.id)
		vi.setSystemTime(new Date('2026-10-10T17:00:00Z'))
		await refreshProjectGithub(scope.db, item.id)
		const newer = repository('old', `repo-${item.id}`)
		newer.data.stargazers_count = 80
		vi.mocked(octokit.rest.repos.get).mockResolvedValue(newer)
		vi.setSystemTime(new Date('2026-10-10T17:01:00Z'))
		await client().admin.project.githubRefresh({ params: { id: item.id } })
		expect(await history(item.id)).toMatchObject([
			{ snapshotDate: '2026-10-10', stars: 90 },
			{
				snapshotDate: '2026-10-11',
				stars: 80,
				observedAt: new Date('2026-10-10T17:01:00Z'),
			},
		])
		const detail = await client(null).project.getBySlug({
			params: { slug: item.slug },
		})
		expect(detail.githubStarsHistory).toMatchObject({
			windowStartDate: '2026-09-11',
			windowEndDate: '2026-10-11',
			comparison: { days: 1, deltaStars: -10 },
		})
		expect(detail.github.stars).toBe(
			detail.githubStarsHistory.points.at(-1)?.stars
		)
		expect(
			await client().admin.project.getById({ params: { id: item.id } })
		).not.toHaveProperty('githubStarsHistory')
		expect(
			(await client(null).project.search({ query: {} })).projects[0]
		).not.toHaveProperty('githubStarsHistory')
		vi.mocked(octokit.rest.repos.getCommit).mockRejectedValue(
			new Error('temporary')
		)
		await expect(refreshProjectGithub(scope.db, item.id)).rejects.toMatchObject(
			{ code: 'INTERNAL_SERVER_ERROR' }
		)
		expect(await history(item.id)).toHaveLength(2)
	})

	it('rolls back statistics, canonical URL, and history deletion if the history write fails', async () => {
		const item = await fixture()
		await refreshProjectGithub(scope.db, item.id)
		const before = await stored(item.id)
		const points = await history(item.id)
		vi.mocked(octokit.rest.repos.get).mockResolvedValue(
			repository('replacement', 'repo', 789)
		)
		await scope.pool.query(
			"CREATE FUNCTION reject_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'history unavailable'; END $$"
		)
		await scope.pool.query(
			'CREATE TRIGGER reject_history BEFORE INSERT ON github_star_history FOR EACH ROW EXECUTE FUNCTION reject_history()'
		)
		try {
			await expect(
				refreshProjectGithub(scope.db, item.id)
			).rejects.toMatchObject({ cause: { code: 'P0001' } })
			expect(await stored(item.id)).toEqual(before)
			expect(await history(item.id)).toEqual(points)
			expect(
				(
					await scope.db.select().from(project).where(eq(project.id, item.id))
				)[0]?.repositoryUrl
			).toBe(item.repositoryUrl)
		} finally {
			await scope.pool.query(
				'DROP TRIGGER reject_history ON github_star_history'
			)
			await scope.pool.query('DROP FUNCTION reject_history()')
		}
	})

	it('preserves history on rename, resets reused URLs and A → B → A, and keeps same-ID basic edits consistent', async () => {
		const item = await fixture()
		await refreshProjectGithub(scope.db, item.id)
		const yesterday = shiftGithubDate(githubSnapshotDate(new Date()), -1)
		await scope.db.insert(githubStarHistory).values({
			projectId: item.id,
			snapshotDate: yesterday,
			stars: 50,
			observedAt: oldTime,
		})
		vi.mocked(octokit.rest.repos.get).mockResolvedValue(
			repository('renamed', 'repo', 123)
		)
		await refreshProjectGithub(scope.db, item.id)
		expect(await history(item.id)).toHaveLength(2)
		const before = await stored(item.id)
		const basic = repository('again', 'repo', 123)
		basic.data.stargazers_count = 999
		vi.mocked(octokit.rest.repos.get).mockResolvedValue(basic)
		vi.mocked(octokit.rest.repos.getLatestRelease).mockRejectedValue(
			new Error('temporary')
		)
		const same = await client().admin.project.update({
			params: { id: item.id },
			body: { repositoryUrl: 'again/repo' },
		})
		expect(same.github).toMatchObject({
			stars: 90,
			latestReleaseTag: 'v2',
			fetchedAt: before?.fetchedAt,
		})
		expect(await history(item.id)).toHaveLength(2)
		vi.mocked(octokit.rest.repos.get).mockResolvedValue(
			repository('again', 'repo', 456)
		)
		vi.mocked(octokit.rest.repos.getLatestRelease).mockResolvedValue({
			data: { tag_name: 'v2' },
		} as unknown as ReleaseResponse)
		await refreshProjectGithub(scope.db, item.id)
		expect(await history(item.id)).toHaveLength(1)
		await scope.db.insert(githubStarHistory).values({
			projectId: item.id,
			snapshotDate: yesterday,
			stars: 20,
			observedAt: oldTime,
		})
		vi.mocked(octokit.rest.repos.get).mockResolvedValue(
			repository('old', `repo-${item.id}`, 123)
		)
		await client().admin.project.update({
			params: { id: item.id },
			body: { repositoryUrl: item.repositoryUrl },
		})
		expect(await history(item.id)).toHaveLength(1)
	})

	it('rejects an older manual completion after the daily job wins the revision race', async () => {
		const item = await fixture()
		let started!: () => void
		let resume!: () => void
		const entered = new Promise<void>((resolve) => {
			started = resolve
		})
		const gate = new Promise<void>((resolve) => {
			resume = resolve
		})
		vi.mocked(octokit.rest.repos.getLatestRelease).mockImplementationOnce(
			async () => {
				started()
				await gate
				return {
					data: { tag_name: 'old-delayed' },
				} as unknown as ReleaseResponse
			}
		)
		const pending = refreshProjectGithub(scope.db, item.id).catch(
			(error: unknown) => error
		)
		await entered
		try {
			expect(await runGithubRefreshBatch(scope.db)).toMatchObject({
				succeeded: 1,
			})
		} finally {
			resume()
		}
		expect(await pending).toMatchObject({ code: 'CONFLICT' })
		expect((await stored(item.id))?.latestReleaseTag).toBe('v2')
		expect(await history(item.id)).toHaveLength(1)
	})

	it('reads statistics and history from the same snapshot during a concurrent write', async () => {
		const item = await fixture()
		await refreshProjectGithub(scope.db, item.id)
		const writer = await scope.pool.connect()
		let pending:
			| ReturnType<ReturnType<typeof client>['project']['getBySlug']>
			| undefined
		try {
			await writer.query('BEGIN')
			await writer.query(
				'LOCK TABLE github_star_history IN ACCESS EXCLUSIVE MODE'
			)
			pending = client(null).project.getBySlug({ params: { slug: item.slug } })
			let blocked = false
			for (let attempt = 0; attempt < 100; attempt++) {
				const lock = await writer.query<{ blocked: boolean }>(
					"SELECT EXISTS (SELECT 1 FROM pg_locks WHERE relation = 'github_star_history'::regclass AND NOT granted) AS blocked"
				)
				if (lock.rows[0]?.blocked) {
					blocked = true
					break
				}
				await new Promise((resolve) => setTimeout(resolve, 20))
			}
			expect(blocked).toBe(true)
			await writer.query(
				'UPDATE github_repositories SET stars = 150 WHERE project_id = $1',
				[item.id]
			)
			await writer.query(
				'UPDATE github_star_history SET stars = 150 WHERE project_id = $1',
				[item.id]
			)
			await writer.query('COMMIT')
			const detail = await pending
			expect(detail.github.stars).toBe(90)
			expect(detail.githubStarsHistory.points.at(-1)?.stars).toBe(90)
			expect(
				(await client(null).project.getBySlug({ params: { slug: item.slug } }))
					.github.stars
			).toBe(150)
		} finally {
			await writer.query('ROLLBACK')
			writer.release()
			if (pending) await pending
		}
	})

	it('bounds public reads to 31 dates and prunes the 90-day boundary for nonpublished projects too', async () => {
		vi.useFakeTimers({ toFake: ['Date'] })
		vi.setSystemTime(new Date('2026-10-11T02:00:00+07:00'))
		const item = await fixture()
		const draft = await fixture('draft')
		const today = githubSnapshotDate(new Date())
		for (const id of [item.id, draft.id]) {
			await scope.db.insert(githubStarHistory).values(
				[-90, -89, -31, -30, -10, 0, 1].map((days) => {
					return {
						projectId: id,
						snapshotDate: shiftGithubDate(today, days),
						stars: 100,
						observedAt: oldTime,
					}
				})
			)
		}
		const detail = await client(null).project.getBySlug({
			params: { slug: item.slug },
		})
		expect(detail.githubStarsHistory.points.map((point) => point.date)).toEqual(
			['2026-09-11', '2026-10-01', '2026-10-11']
		)
		expect(detail.githubStarsHistory.comparison?.days).toBe(30)
		await runGithubRefreshBatch(scope.db)
		expect(
			(await history(draft.id)).map((point) => point.snapshotDate)
		).not.toContain(shiftGithubDate(today, -90))
		expect(
			(await history(draft.id)).map((point) => point.snapshotDate)
		).toContain(shiftGithubDate(today, -89))
	})
})

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
	it('releases the advisory lock and fails fatally when history cleanup fails', async () => {
		const remove = vi.spyOn(scope.db, 'delete').mockImplementationOnce(() => {
			throw new Error('Cleanup unavailable')
		})
		const refresh = vi.fn<typeof refreshProjectGithub>()
		await expect(runGithubRefreshBatch(scope.db, { refresh })).rejects.toThrow(
			'Cleanup unavailable'
		)
		expect(refresh).not.toHaveBeenCalled()
		remove.mockRestore()
		expect(await runGithubRefreshBatch(scope.db)).toMatchObject({
			skipped: false,
		})
	})
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
