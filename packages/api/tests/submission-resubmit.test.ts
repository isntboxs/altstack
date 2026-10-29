import { createRouterClient } from '@orpc/server'
import { eq, sql } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { fileURLToPath } from 'node:url'
import { RequestError } from 'octokit'
import type { MockInstance } from 'vite-plus/test'
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
import * as refresh from '@altstack/api/github-refresh'
import { openApiHandler, rpcHandler } from '@altstack/api/handler'
import { routers } from '@altstack/api/routers'
import * as storage from '@altstack/api/storage'
import { submissionRateLimiter } from '@altstack/api/submission-rate-limit'

import {
	auditLog,
	category,
	githubRepository,
	githubStarHistory,
	project,
	projectCategory,
	user,
} from '@altstack/db/schemas'
import { seedTaxonomy } from '@altstack/db/seed-taxonomy'

import { connectTestPostgres } from '../../db/tests/helpers/postgres'

let postgres: Awaited<ReturnType<typeof connectTestPostgres>>
let scope: Awaited<ReturnType<typeof postgres.createSchema>>
let submitterId: string
let adminId: string
let quota: MockInstance<typeof submissionRateLimiter.limit>
type GithubResult = Awaited<ReturnType<typeof octokit.rest.repos.get>>
const missingId = '550e8400-e29b-41d4-a716-446655440000'
const feedback = 'Please correct the project name and website.'
const originalDate = new Date('2026-01-01T00:00:00Z')
function context(id: string | null = submitterId, role = 'user'): ORPCContext {
	return {
		db: scope.db,
		auth: id ? ({ user: { id, role } } as ORPCContext['auth']) : null,
	}
}
function client(id: string | null = submitterId, role = 'user') {
	return createRouterClient(routers, { context: context(id, role) })
}
function githubResult(
	owner = 'example',
	repo = 'tool',
	id = 123
): GithubResult {
	return {
		data: {
			id,
			private: false,
			owner: { login: owner },
			name: repo,
			stargazers_count: 30,
			forks_count: 4,
		},
	} as GithubResult
}
async function fixture({
	ownerId = submitterId,
	status = 'rejected',
	repo = 'tool',
	repositoryId = 123,
}: {
	ownerId?: string | null
	status?: typeof project.$inferSelect.status
	repo?: string
	repositoryId?: number | null
} = {}) {
	const [row] = await scope.db
		.insert(project)
		.values({
			name: 'Original Tool',
			slug: `original-${repo}`,
			repositoryUrl: `https://github.com/example/${repo}`,
			websiteUrl: 'https://old.example.com',
			status,
			submitterId: ownerId,
			rejectionReason: status === 'rejected' ? feedback : null,
			tagline: 'Enriched tagline',
			description: 'Enriched description',
			content: '# Reviewed copy',
			logo: `projects/original-${repo}/logo-${missingId}.png`,
			screenshot: `projects/original-${repo}/screenshot-${missingId}.png`,
			createdAt: originalDate,
		})
		.returning()
	if (!row) throw new Error('Missing fixture')
	await scope.db.insert(githubRepository).values({
		projectId: row.id,
		owner: 'example',
		repo,
		githubRepositoryId: repositoryId,
		stars: 20,
		forks: 2,
		fetchedAt: originalDate,
		lastCommitAt: originalDate,
		repositoryCreatedAt: originalDate,
		latestReleaseTag: 'v1.0',
		metadataFetchedAt: originalDate,
	})
	await scope.db.insert(githubStarHistory).values({
		projectId: row.id,
		stars: 20,
		snapshotDate: '2026-10-13',
		observedAt: originalDate,
	})
	const [leaf] = await scope.db
		.select()
		.from(category)
		.where(eq(category.slug, 'backend'))
	await scope.db
		.insert(projectCategory)
		.values({ projectId: row.id, categoryId: leaf!.id })
	await scope.db.insert(auditLog).values([
		{ actorId: ownerId, projectId: row.id, action: 'project_submitted' },
		{
			actorId: adminId,
			projectId: row.id,
			action: 'project_status_changed',
			reason: feedback,
			metadata: { fromStatus: 'draft', toStatus: 'rejected' },
		},
	])
	return row
}
async function request(id: string, overrides: Record<string, unknown> = {}) {
	const intake = await client().submission.getById({ params: { id } })
	return {
		params: { id },
		body: {
			name: 'Corrected Tool',
			repositoryUrl: 'example/tool',
			websiteUrl: 'https://new.example.com',
			revision: intake.revision,
			...overrides,
		},
	}
}
async function snapshot() {
	return {
		projects: await scope.db.select().from(project).orderBy(project.id),
		github: await scope.db
			.select()
			.from(githubRepository)
			.orderBy(githubRepository.projectId),
		history: await scope.db
			.select()
			.from(githubStarHistory)
			.orderBy(githubStarHistory.projectId),
		categories: await scope.db
			.select()
			.from(projectCategory)
			.orderBy(projectCategory.projectId),
		audit: await scope.db.select().from(auditLog).orderBy(auditLog.id),
	}
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
	const users = await scope.db
		.insert(user)
		.values([
			{ name: 'Submitter', email: 'resubmit@example.com', role: 'user' },
			{ name: 'Admin', email: 'resubmit-admin@example.com', role: 'admin' },
		])
		.returning()
	submitterId = users[0]!.id
	adminId = users[1]!.id
	vi.spyOn(octokit.rest.repos, 'get')
	quota = vi.spyOn(submissionRateLimiter, 'limit')
	vi.spyOn(refresh, 'enrichProjectGithubBestEffort').mockResolvedValue(null)
	vi.spyOn(storage, 'deleteFinalKeysBestEffort').mockResolvedValue(undefined)
}, 60_000)
beforeEach(async () => {
	await scope.db.delete(auditLog)
	await scope.db.delete(project)
	vi.mocked(octokit.rest.repos.get)
		.mockReset()
		.mockImplementation((parameters) =>
			Promise.resolve(githubResult(parameters?.owner, parameters?.repo))
		)
	quota.mockReset().mockResolvedValue({
		success: true,
		limit: 5,
		remaining: 4,
		reset: Date.now() + 600_000,
	})
})
afterAll(async () => {
	vi.restoreAllMocks()
	await scope.close()
	await postgres.close()
}, 60_000)

describe('private rejected intake', () => {
	it.each(['collections', 'Collections', 'tags', 'bookmarks'])(
		'creates a reachable generated slug for a submission named %s',
		async (name) => {
			const result = await client().submission.create({
				name,
				repositoryUrl: 'https://github.com/example/new-tool',
			})
			const [created] = await scope.db
				.select()
				.from(project)
				.where(eq(project.id, result.id))
			expect(created?.slug).toBe(`${name.toLowerCase()}-project`)
		}
	)
	it('returns only intake, feedback and a revision, with no quota charge', async () => {
		const row = await fixture()
		expect(
			await client().submission.getById({ params: { id: row.id } })
		).toEqual({
			id: row.id,
			name: row.name,
			repositoryUrl: row.repositoryUrl,
			websiteUrl: row.websiteUrl,
			status: 'rejected',
			rejectionReason: feedback,
			revision: (await client().submission.getById({ params: { id: row.id } }))
				.revision,
		})
		expect(quota).not.toHaveBeenCalled()
		expect(octokit.rest.repos.get).not.toHaveBeenCalled()
	})
	it.each([null, 'foreign', 'admin', 'missing', 'no-submitter'] as const)(
		'conceals feedback and rejects mutation for %s',
		async (actor) => {
			const row = await fixture({
				ownerId: actor === 'no-submitter' ? null : submitterId,
			})
			const id = actor === 'missing' ? missingId : row.id
			const caller =
				actor === null
					? client(null)
					: actor === 'foreign' || actor === 'admin'
						? client(adminId, actor === 'admin' ? 'admin' : 'user')
						: client()
			const before = await snapshot()
			const code = actor === null ? 'UNAUTHORIZED' : 'NOT_FOUND'
			await expect(
				caller.submission.getById({ params: { id } })
			).rejects.toMatchObject({ code })
			await expect(
				caller.submission.resubmit({
					params: { id },
					body: {
						name: 'Corrected',
						repositoryUrl: 'example/tool',
						revision: '1',
					},
				})
			).rejects.toMatchObject({ code })
			expect(await snapshot()).toEqual(before)
			expect(octokit.rest.repos.get).not.toHaveBeenCalled()
		}
	)
	it.each(['draft', 'published', 'removed'] as const)(
		'blocks reading/editing %s targets',
		async (status) => {
			const row = await fixture({ status })
			const before = await snapshot()
			await expect(
				client().submission.getById({ params: { id: row.id } })
			).rejects.toMatchObject({ code: 'CONFLICT' })
			await expect(
				client().submission.resubmit({
					params: { id: row.id },
					body: {
						name: 'Corrected',
						repositoryUrl: 'example/tool',
						revision: '1',
					},
				})
			).rejects.toMatchObject({ code: 'CONFLICT' })
			expect(await snapshot()).toEqual(before)
			expect(octokit.rest.repos.get).not.toHaveBeenCalled()
		}
	)
})

describe('resubmit transition and repository identity', () => {
	it('updates the same project, retains provenance/enrichment/history, and audits the actor and old feedback', async () => {
		const row = await fixture()
		const before = await snapshot()
		const input = await request(row.id, {
			repositoryUrl: 'http://www.GITHUB.com/EXAMPLE/Tool.git/',
		})
		expect(await client().submission.resubmit(input)).toEqual({
			id: row.id,
			status: 'draft',
		})
		const after = await snapshot()
		expect(after.projects).toHaveLength(1)
		expect(after.projects[0]).toMatchObject({
			...row,
			name: 'Corrected Tool',
			websiteUrl: 'https://new.example.com',
			status: 'draft',
			rejectionReason: null,
			updatedAt: after.projects[0]!.updatedAt,
			searchVector: after.projects[0]!.searchVector,
		})
		expect(after.github[0]).toMatchObject({
			...before.github[0],
			updatedAt: after.github[0]!.updatedAt,
		})
		expect(after.history).toEqual(before.history)
		expect(after.categories).toEqual(before.categories)
		expect(after.audit).toEqual(expect.arrayContaining(before.audit))
		expect(after.audit).toHaveLength(before.audit.length + 1)
		expect(after.audit).toContainEqual(
			expect.objectContaining({
				actorId: submitterId,
				action: 'project_status_changed',
				projectId: row.id,
				metadata: {
					fromStatus: 'rejected',
					toStatus: 'draft',
					source: 'submitter_resubmit',
					previousRejectionReason: feedback,
					intake: {
						before: {
							name: row.name,
							repositoryUrl: row.repositoryUrl,
							websiteUrl: row.websiteUrl,
						},
						after: {
							name: 'Corrected Tool',
							repositoryUrl: row.repositoryUrl,
							websiteUrl: 'https://new.example.com',
						},
					},
				},
			})
		)
		expect(
			(await client().submission.list({ query: {} })).submissions[0]
		).toMatchObject({ id: row.id, status: 'draft', rejectionReason: null })
		await expect(
			client(null).project.getBySlug({ params: { slug: row.slug } })
		).rejects.toMatchObject({ code: 'NOT_FOUND' })
	})
	it('allows an admin to resubmit their own intake with the same policy', async () => {
		const row = await fixture({ ownerId: adminId })
		const caller = client(adminId, 'admin')
		const intake = await caller.submission.getById({ params: { id: row.id } })
		await expect(
			caller.submission.resubmit({
				params: { id: row.id },
				body: {
					name: 'Corrected',
					repositoryUrl: row.repositoryUrl,
					revision: intake.revision,
				},
			})
		).resolves.toEqual({ id: row.id, status: 'draft' })
		expect(quota).toHaveBeenCalledWith(`user:${adminId}`, { weight: undefined })
	})
	it('retains observations across a GitHub rename or transfer with the same ID', async () => {
		const row = await fixture()
		const before = await snapshot()
		vi.mocked(octokit.rest.repos.get).mockResolvedValue(
			githubResult('NewOrg', 'NewName')
		)
		await client().submission.resubmit(
			await request(row.id, { repositoryUrl: 'oldorg/oldname' })
		)
		const after = await snapshot()
		expect(after.projects[0]).toMatchObject({
			id: row.id,
			slug: row.slug,
			repositoryUrl: 'https://github.com/neworg/newname',
		})
		expect(after.github[0]).toMatchObject({
			owner: 'neworg',
			repo: 'newname',
			githubRepositoryId: 123,
			stars: 20,
			forks: 2,
			fetchedAt: originalDate,
			metadataFetchedAt: originalDate,
		})
		expect(after.history).toEqual(before.history)
	})
	it.each([123, null])(
		'resets unrelated metadata/history when previous identity was %s',
		async (repositoryId) => {
			const row = await fixture({ repositoryId })
			vi.mocked(octokit.rest.repos.get).mockResolvedValue(
				githubResult('another', 'repository', 456)
			)
			await client().submission.resubmit(
				await request(row.id, {
					repositoryUrl: 'another/repository',
					websiteUrl: '',
				})
			)
			const after = await snapshot()
			expect(after.projects[0]).toMatchObject({
				id: row.id,
				slug: row.slug,
				websiteUrl: null,
				content: row.content,
				logo: row.logo,
				screenshot: row.screenshot,
			})
			expect(after.github[0]).toMatchObject({
				githubRepositoryId: 456,
				owner: 'another',
				repo: 'repository',
				stars: 30,
				forks: 4,
				lastCommitAt: null,
				repositoryCreatedAt: null,
				latestReleaseTag: null,
				metadataFetchedAt: null,
			})
			expect(after.history).toEqual([])
		}
	)
	it('repairs a legacy intake without repository metadata or feedback without inventing history', async () => {
		const row = await fixture()
		await scope.db
			.delete(githubRepository)
			.where(eq(githubRepository.projectId, row.id))
		await scope.db
			.update(project)
			.set({ rejectionReason: null })
			.where(eq(project.id, row.id))
		await client().submission.resubmit(await request(row.id))
		expect((await snapshot()).github[0]).toMatchObject({
			githubRepositoryId: 123,
			stars: 30,
			forks: 4,
		})
		expect((await snapshot()).history).toEqual([])
	})
	it.each(['canonical', 'resolved-alias', 'stored-identity'] as const)(
		'rejects %s conflicts without changing either project',
		async (kind) => {
			const row = await fixture()
			await fixture({ repo: 'other', repositoryId: 456 })
			if (kind !== 'canonical') {
				vi.mocked(octokit.rest.repos.get).mockResolvedValue(
					githubResult(
						'example',
						kind === 'resolved-alias' ? 'other' : 'renamed-other',
						456
					)
				)
			}
			const before = await snapshot()
			await expect(
				client().submission.resubmit(
					await request(row.id, {
						repositoryUrl:
							kind === 'canonical'
								? 'http://www.github.com/EXAMPLE/Other.GIT/'
								: 'old/alias',
					})
				)
			).rejects.toMatchObject({ code: 'CONFLICT' })
			expect(await snapshot()).toEqual(before)
			expect(octokit.rest.repos.get).toHaveBeenCalledTimes(
				kind === 'canonical' ? 0 : 1
			)
		}
	)
	it('keeps create duplicate-rejected behavior intact', async () => {
		await fixture()
		await expect(
			client().submission.create({
				name: 'Repeated',
				repositoryUrl: 'example/tool',
			})
		).rejects.toMatchObject({ code: 'CONFLICT' })
		expect(octokit.rest.repos.get).not.toHaveBeenCalled()
	})
})

describe('failures and concurrency', () => {
	it.each(['create', 'resubmit'] as const)(
		'serializes a resubmit against %s when GitHub reports different URLs for the same immutable identity',
		async (operation) => {
			const row = await fixture()
			const other =
				operation === 'resubmit'
					? await fixture({
							ownerId: adminId,
							repo: 'other',
							repositoryId: 456,
						})
					: null
			const input = await request(row.id, { repositoryUrl: 'renaming/tool' })
			const otherIntake = other
				? await client(adminId, 'admin').submission.getById({
						params: { id: other.id },
					})
				: null
			const gate = Promise.withResolvers<void>()
			let calls = 0
			vi.mocked(octokit.rest.repos.get).mockImplementation(
				async (parameters) => {
					if (++calls === 2) gate.resolve()
					await gate.promise
					return githubResult('renaming', parameters?.repo, 789)
				}
			)
			const results = await Promise.allSettled([
				client().submission.resubmit(input),
				other && otherIntake
					? client(adminId, 'admin').submission.resubmit({
							params: { id: other.id },
							body: {
								name: 'Other correction',
								repositoryUrl: 'renaming/newname',
								revision: otherIntake.revision,
							},
						})
					: client(adminId, 'admin').submission.create({
							name: 'New intake',
							repositoryUrl: 'renaming/newname',
						}),
			])
			expect(
				results.filter((result) => result.status === 'fulfilled')
			).toHaveLength(1)
			expect(
				results.find((result) => result.status === 'rejected')
			).toMatchObject({ reason: { code: 'CONFLICT' } })
			expect(
				(await snapshot()).github.filter(
					(item) => item.githubRepositoryId === 789
				)
			).toHaveLength(1)
		}
	)
	it('does not let a prepared admin update overwrite a successful resubmit', async () => {
		const row = await fixture()
		const input = await request(row.id)
		const started = Promise.withResolvers<void>()
		const release = Promise.withResolvers<void>()
		vi.mocked(octokit.rest.repos.get).mockImplementationOnce(async () => {
			started.resolve()
			await release.promise
			return githubResult('admin', 'changed', 456)
		})
		const outcome = client(adminId, 'admin')
			.admin.project.update({
				params: { id: row.id },
				body: { repositoryUrl: 'admin/changed' },
			})
			.catch((error: unknown) => error)
		let saved
		try {
			await started.promise
			await client().submission.resubmit(input)
			saved = await snapshot()
		} finally {
			release.resolve()
		}
		expect(await outcome).toMatchObject({ code: 'CONFLICT' })
		expect(await snapshot()).toEqual(saved)
	})
	it.each(['missing', 'private', 'github-limit', 'network', 'redis'] as const)(
		'preserves all records on %s failure',
		async (failure) => {
			const row = await fixture()
			const input = await request(row.id)
			const before = await snapshot()
			const codes = {
				missing: 'NOT_FOUND',
				private: 'BAD_REQUEST',
				'github-limit': 'TOO_MANY_REQUESTS',
				network: 'INTERNAL_SERVER_ERROR',
				redis: undefined,
			}
			if (failure === 'private') {
				vi.mocked(octokit.rest.repos.get).mockResolvedValue({
					data: { ...githubResult().data, private: true },
				} as GithubResult)
			} else if (failure === 'redis') {
				quota.mockRejectedValue(new Error('Redis unavailable'))
			} else {
				vi.mocked(octokit.rest.repos.get).mockRejectedValue(
					failure === 'network'
						? new Error('offline')
						: new RequestError(
								'GitHub failure',
								failure === 'missing' ? 404 : 429,
								{
									request: {
										method: 'GET',
										url: 'https://api.github.test',
										headers: {},
									},
								}
							)
				)
			}
			const failureResult: unknown = await client()
				.submission.resubmit(input)
				.catch((error: unknown) => error)
			expect(failureResult).toBeInstanceOf(Error)
			expect(failureResult).toMatchObject(
				failure === 'redis'
					? { message: 'Redis unavailable' }
					: { code: codes[failure] }
			)
			expect(await snapshot()).toEqual(before)
			expect(octokit.rest.repos.get).toHaveBeenCalledTimes(
				failure === 'redis' ? 0 : 1
			)
		}
	)
	it('rolls back project, repository, history and audit when the audit insert fails', async () => {
		const row = await fixture()
		const input = await request(row.id, { repositoryUrl: 'new/repo' })
		const before = await snapshot()
		vi.mocked(octokit.rest.repos.get).mockResolvedValue(
			githubResult('new', 'repo', 456)
		)
		await scope.db.execute(
			sql`CREATE FUNCTION fail_resubmit_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test audit failure'; END $$`
		)
		await scope.db.execute(
			sql`CREATE TRIGGER fail_resubmit_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION fail_resubmit_audit()`
		)
		try {
			await expect(client().submission.resubmit(input)).rejects.toMatchObject({
				code: 'INTERNAL_SERVER_ERROR',
			})
			expect(await snapshot()).toEqual(before)
		} finally {
			await scope.db.execute(sql`DROP TRIGGER fail_resubmit_audit ON audit_log`)
			await scope.db.execute(sql`DROP FUNCTION fail_resubmit_audit()`)
		}
	})
	it('rejects a stale prefill even if status and timestamps are unchanged', async () => {
		const row = await fixture()
		const input = await request(row.id)
		await scope.db
			.update(project)
			.set({ rejectionReason: 'Updated feedback', updatedAt: row.updatedAt })
			.where(eq(project.id, row.id))
		const before = await snapshot()
		await expect(client().submission.resubmit(input)).rejects.toMatchObject({
			code: 'CONFLICT',
		})
		expect(await snapshot()).toEqual(before)
		expect(octokit.rest.repos.get).not.toHaveBeenCalled()
	})
	it.each([
		'draft',
		'published',
		'rejected',
		'removed',
		'owner',
		'delete',
	] as const)(
		'does not overwrite concurrent admin %s while GitHub is in flight',
		async (change) => {
			const row = await fixture()
			const input = await request(row.id)
			const started = Promise.withResolvers<void>()
			const release = Promise.withResolvers<void>()
			vi.mocked(octokit.rest.repos.get).mockImplementationOnce(async () => {
				started.resolve()
				await release.promise
				return githubResult()
			})
			const outcome = client()
				.submission.resubmit(input)
				.catch((error: unknown) => error)
			let before
			try {
				await started.promise
				// A short lock deadline also proves no project lock spans the fetch.
				if (change === 'owner' || change === 'delete') {
					await scope.db.transaction(async (tx) => {
						await tx.execute(sql`SET LOCAL lock_timeout = '1s'`)
						if (change === 'owner') {
							await tx
								.update(project)
								.set({ submitterId: adminId })
								.where(eq(project.id, row.id))
						} else await tx.delete(project).where(eq(project.id, row.id))
					})
				} else {
					await client(adminId, 'admin').admin.project.update({
						params: { id: row.id },
						body: {
							status: change,
							...(change === 'rejected'
								? { rejectionReason: 'New review decision' }
								: {}),
						},
					})
				}
				before = await snapshot()
			} finally {
				release.resolve()
			}
			expect(await outcome).toMatchObject({
				code:
					change === 'owner' || change === 'delete' ? 'NOT_FOUND' : 'CONFLICT',
			})
			expect(await snapshot()).toEqual(before)
		}
	)
	it('allows exactly one concurrent resubmit of the same rejected project', async () => {
		const row = await fixture()
		const input = await request(row.id)
		const gate = Promise.withResolvers<void>()
		let calls = 0
		vi.mocked(octokit.rest.repos.get).mockImplementation(async () => {
			if (++calls === 2) gate.resolve()
			await gate.promise
			return githubResult()
		})
		const results = await Promise.allSettled([
			client().submission.resubmit(input),
			client().submission.resubmit({
				...input,
				body: { ...input.body, name: 'Second correction' },
			}),
		])
		expect(
			results.filter((result) => result.status === 'fulfilled')
		).toHaveLength(1)
		expect(
			results.find((result) => result.status === 'rejected')
		).toMatchObject({ reason: { code: 'CONFLICT' } })
		expect((await snapshot()).audit).toHaveLength(3)
	})
	it('blocks resubmit at ten open drafts before GitHub', async () => {
		const row = await fixture()
		for (let index = 0; index < 10; index++) {
			await fixture({
				repo: `draft-${index}`,
				status: 'draft',
				repositoryId: index + 1000,
			})
		}
		const before = await snapshot()
		await expect(
			client().submission.resubmit(await request(row.id))
		).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS', data: undefined })
		expect(await snapshot()).toEqual(before)
		expect(octokit.rest.repos.get).not.toHaveBeenCalled()
	})
	it.each(['create', 'resubmit'] as const)(
		'shares the last draft slot with concurrent %s',
		async (operation) => {
			const row = await fixture()
			const second =
				operation === 'resubmit'
					? await fixture({ repo: 'second', repositoryId: 456 })
					: null
			for (let index = 0; index < 9; index++) {
				await fixture({
					repo: `draft-${index}`,
					status: 'draft',
					repositoryId: index + 1000,
				})
			}
			const input = await request(row.id)
			const secondInput = second
				? await request(second.id, { repositoryUrl: 'example/second' })
				: null
			const gate = Promise.withResolvers<void>()
			let calls = 0
			vi.mocked(octokit.rest.repos.get).mockImplementation(
				async (parameters) => {
					if (++calls === 2) gate.resolve()
					await gate.promise
					return githubResult(
						parameters?.owner,
						parameters?.repo,
						parameters?.repo === 'tool' ? 123 : 456
					)
				}
			)
			const results = await Promise.allSettled([
				client().submission.resubmit(input),
				secondInput
					? client().submission.resubmit(secondInput)
					: client().submission.create({
							name: 'Second intake',
							repositoryUrl: 'example/second',
						}),
			])
			expect(
				results.filter((result) => result.status === 'fulfilled')
			).toHaveLength(1)
			expect(
				results.find((result) => result.status === 'rejected')
			).toMatchObject({ reason: { code: 'TOO_MANY_REQUESTS' } })
			expect(
				(await snapshot()).projects.filter((item) => item.status === 'draft')
			).toHaveLength(10)
		}
	)
})

describe.each(['rpc', 'rest'] as const)(
	'%s protected HTTP procedures',
	(transport) => {
		async function http(
			operation: 'getById' | 'resubmit',
			id: string,
			body: unknown,
			auth: ORPCContext['auth']
		) {
			const handler = transport === 'rpc' ? rpcHandler : openApiHandler
			const url =
				transport === 'rpc'
					? `/submission/${operation}`
					: `/submissions/${id}${operation === 'resubmit' ? '/resubmit' : ''}`
			return handler.handle(
				new Request(`http://localhost${url}`, {
					method:
						transport === 'rest' && operation === 'getById' ? 'QUERY' : 'POST',
					headers: { 'content-type': 'application/json' },
					...(transport === 'rpc'
						? {
								body: JSON.stringify({
									json: {
										params: { id },
										...(operation === 'resubmit' ? { body } : {}),
									},
								}),
							}
						: operation === 'resubmit'
							? { body: JSON.stringify(body) }
							: {}),
				}),
				{ context: { db: scope.db, auth } }
			)
		}
		it('enforces session/private reads, strict fields, revision and the real success transition', async () => {
			const row = await fixture()
			const input = await request(row.id)
			const auth = context().auth
			for (const operation of ['getById', 'resubmit'] as const) {
				expect(
					(await http(operation, row.id, input.body, null)).response?.status
				).toBe(401)
				expect(
					(
						await http(
							operation,
							row.id,
							input.body,
							context(adminId, 'admin').auth
						)
					).response?.status
				).toBe(404)
			}
			const read = await http('getById', row.id, undefined, auth)
			expect(read.response?.status).toBe(200)
			for (const body of [
				{ ...input.body, status: 'published' },
				{ ...input.body, revision: undefined },
				{ ...input.body, repositoryUrl: 'invalid' },
			]) {
				expect(
					(await http('resubmit', row.id, body, auth)).response?.status
				).toBe(400)
			}
			expect(
				(await http('resubmit', row.id, { ...input.body, revision: '1' }, auth))
					.response?.status
			).toBe(409)
			const saved = await http('resubmit', row.id, input.body, auth)
			expect(saved.response?.status).toBe(200)
			expect((await snapshot()).projects[0]).toMatchObject({
				id: row.id,
				status: 'draft',
				rejectionReason: null,
			})
			expect(
				(await http('getById', row.id, undefined, auth)).response?.status
			).toBe(409)
		})
	}
)
