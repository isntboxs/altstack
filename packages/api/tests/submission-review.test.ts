import { createRouterClient } from '@orpc/server'
import { eq, sql } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
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
import { lockCategoryIntegrity } from '@altstack/api/queries/category-integrity'
import { routers } from '@altstack/api/routers'
import * as storage from '@altstack/api/storage'
import { submissionRateLimiter } from '@altstack/api/submission-rate-limit'

import {
	auditLog,
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
let submitterId: string
let adminId: string
type GithubResult = Awaited<ReturnType<typeof octokit.rest.repos.get>>
function client(role: 'admin' | 'user' | null) {
	const auth = role
		? ({
				user: { id: role === 'admin' ? adminId : submitterId, role },
			} as ORPCContext['auth'])
		: null
	return createRouterClient(routers, { context: { db: scope.db, auth } })
}
async function seedDrafts(
	amount: number,
	ownerId: string,
	prefix = 'capacity'
) {
	const rows = await scope.db
		.insert(project)
		.values(
			Array.from({ length: amount }, (_, index) => {
				return {
					name: `Capacity ${index}`,
					slug: `${prefix}-${index}`,
					repositoryUrl: `https://github.com/${prefix}/repo-${index}`,
					status: 'draft' as const,
					submitterId: ownerId,
				}
			})
		)
		.returning()
	await scope.db.insert(githubRepository).values(
		rows.map((row, index) => {
			return {
				projectId: row.id,
				owner: prefix,
				repo: `repo-${index}`,
				fetchedAt: new Date(),
			}
		})
	)
	return rows
}
const input = (repo = 'review/example') => {
	return {
		name: 'Review Tool',
		repositoryUrl: repo,
	}
}
const complete = {
	tagline: 'Useful software',
	description: 'An open source software tool.',
	logo: 'tmp/logos/review-1.png',
	categorySlugs: ['backend'],
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
	const [submitter, admin] = await scope.db
		.insert(user)
		.values([
			{ name: 'Submitter', email: 'submitter@example.com', role: 'user' },
			{ name: 'Reviewer', email: 'reviewer@example.com', role: 'admin' },
		])
		.returning()
	if (!submitter || !admin) throw new Error('Missing test users')
	submitterId = submitter.id
	adminId = admin.id
	vi.spyOn(octokit.rest.repos, 'get')
	// These cases exercise review/storage/capacity; quota is tested separately.
	vi.spyOn(submissionRateLimiter, 'limit').mockResolvedValue({
		success: true,
		limit: 5,
		remaining: 4,
		reset: Date.now() + 600_000,
	})
	vi.spyOn(storage, 'promoteTempImageToProject')
	vi.spyOn(storage, 'copyS3Object').mockResolvedValue(undefined)
	vi.spyOn(storage, 'deleteFinalKeysBestEffort').mockResolvedValue(undefined)
}, 60_000)

beforeEach(async () => {
	await scope.db.delete(auditLog)
	await scope.db.delete(project)
	vi.mocked(octokit.rest.repos.get)
		.mockReset()
		.mockImplementation((parameters) =>
			Promise.resolve({
				data: {
					private: false,
					owner: { login: parameters?.owner },
					name: parameters?.repo,
					stargazers_count: 0,
					forks_count: 2,
				},
			} as unknown as GithubResult)
		)
	vi.mocked(storage.promoteTempImageToProject)
		.mockReset()
		.mockImplementation(({ slug, kind }) =>
			Promise.resolve(
				`projects/${slug}/${kind}-550e8400-e29b-41d4-a716-446655440000.png`
			)
		)
	vi.mocked(storage.copyS3Object).mockReset().mockResolvedValue(undefined)
	vi.mocked(storage.deleteFinalKeysBestEffort).mockClear()
})

afterAll(async () => {
	vi.restoreAllMocks()
	await scope.close()
	await postgres.close()
}, 60_000)

describe('owner submission listing', () => {
	it('requires authentication', async () => {
		await expect(
			client(null).submission.list({ query: {} })
		).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
	})
	it('returns only the session owner rows and counts, excluding other users and admin-created projects', async () => {
		const mine = await client('user').submission.create(input('review/mine'))
		await client('admin').submission.create(input('review/other-owner'))
		await client('admin').admin.project.create({
			body: {
				...input('review/admin-created'),
				slug: 'admin-created',
				status: 'draft',
			},
		})
		const query = { page: 1, submitterId: adminId, userId: adminId }
		const result = await client('user').submission.list({ query })
		expect(result.submissions.map((row) => row.id)).toEqual([mine.id])
		expect(result.pagination).toMatchObject({
			totalItems: 1,
			totalPages: 1,
			page: 1,
			limit: 25,
		})
		expect(Object.keys(result.submissions[0]!).toSorted()).toEqual(
			[
				'id',
				'name',
				'slug',
				'logo',
				'repositoryUrl',
				'status',
				'rejectionReason',
				'createdAt',
			].toSorted()
		)
		expect(result.submissions[0]).toMatchObject({ logo: null, status: 'draft' })
		expect(
			(await client('admin').admin.project.list({ query: {} })).pagination
				.totalItems
		).toBe(3)
		expect(
			(await client('admin').submission.list({ query: {} })).pagination
				.totalItems
		).toBe(1)
	})
	it('returns all of the owner review statuses and their rejection reason', async () => {
		for (const status of [
			'draft',
			'published',
			'rejected',
			'removed',
		] as const) {
			const created = await client('user').submission.create(
				input(`review/${status}`)
			)
			await scope.db
				.update(project)
				.set({
					status,
					rejectionReason: status === 'rejected' ? 'Needs documentation' : null,
				})
				.where(eq(project.id, created.id))
		}
		const result = await client('user').submission.list({ query: {} })
		expect(result.submissions.map((row) => row.status).toSorted()).toEqual(
			['draft', 'published', 'rejected', 'removed'].toSorted()
		)
		expect(
			result.submissions.find((row) => row.status === 'rejected')
				?.rejectionReason
		).toBe('Needs documentation')
	})
	it('paginates with a stable tie breaker and filters names without wildcard expansion', async () => {
		for (const [index, name] of [
			'Alpha 100%',
			'Alpha 100 tools',
			'Beta',
		].entries()) {
			await client('user').submission.create({
				...input(`review/list-${index}`),
				name,
			})
		}
		await client('admin').submission.create({
			...input('review/hidden-alpha'),
			name: 'Alpha other user',
		})
		await scope.db
			.update(project)
			.set({ createdAt: new Date('2026-01-01T00:00:00Z') })
		const all = await client('user').submission.list({ query: {} })
		const first = await client('user').submission.list({ query: { limit: 2 } })
		const second = await client('user').submission.list({
			query: { page: 2, limit: 2 },
		})
		expect([...first.submissions, ...second.submissions]).toEqual(
			all.submissions
		)
		expect(first.pagination).toMatchObject({
			totalItems: 3,
			totalPages: 2,
			hasNextPage: true,
			hasPreviousPage: false,
		})
		expect(second.pagination).toMatchObject({
			hasNextPage: false,
			hasPreviousPage: true,
		})
		const filtered = await client('user').submission.list({
			query: { q: '  alpha  ', limit: 1 },
		})
		expect(filtered.pagination.totalItems).toBe(2)
		expect(filtered.submissions).toHaveLength(1)
		const literal = await client('user').submission.list({ query: { q: '%' } })
		expect(literal.submissions.map((row) => row.name)).toEqual(['Alpha 100%'])
		const beyond = await client('user').submission.list({ query: { page: 10 } })
		expect(beyond.submissions).toEqual([])
		expect(beyond.pagination.totalItems).toBe(3)
	})
	it('returns an empty list for users without submissions', async () => {
		await client('admin').submission.create(input('review/other-owner'))
		expect(await client('user').submission.list({ query: {} })).toMatchObject({
			submissions: [],
			pagination: { totalItems: 0, totalPages: 0, hasNextPage: false },
		})
	})
})

describe('protected submissions', () => {
	it('stores the repository identity resolved by GitHub and rejects old aliases without modifying it', async () => {
		vi.mocked(octokit.rest.repos.get).mockResolvedValue({
			data: {
				private: false,
				owner: { login: 'NewOrg' },
				name: 'CurrentTool',
				stargazers_count: 7,
				forks_count: 3,
			},
		} as GithubResult)
		const draft = await client('user').submission.create(
			input('old-org/old-tool')
		)
		const detail = await client('admin').admin.project.getById({
			params: { id: draft.id },
		})
		expect(detail).toMatchObject({
			repositoryUrl: 'https://github.com/neworg/currenttool',
			github: { owner: 'neworg', repo: 'currenttool', stars: 7, forks: 3 },
		})
		const before = await scope.db.select().from(project)
		await expect(
			client('admin').submission.create(input('another-old-org/alias'))
		).rejects.toMatchObject({ code: 'CONFLICT' })
		expect(await scope.db.select().from(project)).toEqual(before)
		expect(await scope.db.select().from(githubRepository)).toHaveLength(1)
		expect(await scope.db.select().from(auditLog)).toHaveLength(1)
	})
	it('allows one winner when two different aliases resolve concurrently to one repository', async () => {
		vi.mocked(octokit.rest.repos.get).mockResolvedValue({
			data: {
				private: false,
				owner: { login: 'current-owner' },
				name: 'current-repo',
				stargazers_count: 0,
				forks_count: 0,
			},
		} as GithubResult)
		const results = await Promise.allSettled([
			client('user').submission.create(input('old/first-alias')),
			client('admin').submission.create(input('older/second-alias')),
		])
		expect(
			results.filter((result) => result.status === 'fulfilled')
		).toHaveLength(1)
		expect(
			results.find((result) => result.status === 'rejected')
		).toMatchObject({ reason: { code: 'CONFLICT' } })
		expect(await scope.db.select().from(project)).toHaveLength(1)
		expect(await scope.db.select().from(githubRepository)).toHaveLength(1)
		expect(await scope.db.select().from(auditLog)).toHaveLength(1)
	})
	it('enforces ten open drafts before GitHub and allows submissions after review frees a slot', async () => {
		const rows = await seedDrafts(10, submitterId)
		await expect(
			client('user').submission.create(input())
		).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' })
		expect(octokit.rest.repos.get).not.toHaveBeenCalled()
		expect(await scope.db.select().from(auditLog)).toEqual([])
		await client('admin').admin.project.update({
			params: { id: rows[0]!.id },
			body: { status: 'rejected' },
		})
		expect(await client('user').submission.create(input())).toMatchObject({
			status: 'draft',
		})
	})
	it('counts only the authenticated user open drafts', async () => {
		await seedDrafts(10, adminId, 'other-capacity')
		await seedDrafts(10, submitterId, 'closed-capacity')
		await scope.db
			.update(project)
			.set({ status: 'rejected' })
			.where(eq(project.submitterId, submitterId))
		expect(await client('user').submission.create(input())).toMatchObject({
			status: 'draft',
		})
	})
	it('does not exceed the draft cap when submissions race for the last slot', async () => {
		await seedDrafts(9, submitterId)
		const results = await Promise.allSettled([
			client('user').submission.create(input('review/first-slot')),
			client('user').submission.create(input('review/second-slot')),
		])
		expect(
			results.filter((result) => result.status === 'fulfilled')
		).toHaveLength(1)
		expect(
			results.find((result) => result.status === 'rejected')
		).toMatchObject({ reason: { code: 'TOO_MANY_REQUESTS' } })
		expect(await scope.db.select().from(project)).toHaveLength(10)
		expect(await scope.db.select().from(githubRepository)).toHaveLength(10)
		expect(await scope.db.select().from(auditLog)).toHaveLength(1)
	})
	it('requires login before looking up GitHub', async () => {
		await expect(client(null).submission.create(input())).rejects.toMatchObject(
			{ code: 'UNAUTHORIZED' }
		)
		expect(octokit.rest.repos.get).not.toHaveBeenCalled()
	})
	it('creates a minimal draft, canonical metadata, submitter and audit, even with zero stars', async () => {
		const result = await client('user').submission.create({
			name: '  Review Tool  ',
			repositoryUrl: 'https://github.com/ReView/EXAMPLE.git/',
			websiteUrl: '  ',
		})
		expect(result.status).toBe('draft')
		expect(result.id).toMatch(/^[a-f0-9-]{36}$/)
		const detail = await client('admin').admin.project.getById({
			params: { id: result.id },
		})
		expect(detail).toMatchObject({
			name: 'Review Tool',
			slug: 'review-tool',
			tagline: null,
			description: null,
			logo: null,
			websiteUrl: null,
			categories: [],
			submitterId,
			submitter: { name: 'Submitter', email: 'submitter@example.com' },
			github: { owner: 'review', repo: 'example', stars: 0, forks: 2 },
		})
		const audits = await scope.db.select().from(auditLog)
		expect(audits).toHaveLength(1)
		expect(audits[0]).toMatchObject({
			action: 'project_submitted',
			actorId: submitterId,
			projectId: result.id,
		})
		const listed = await client('admin').admin.project.list({
			query: { status: 'draft' },
		})
		expect(listed.projects[0]?.submitter?.id).toBe(submitterId)
	})
	it.each(['private', 'missing', 'rate limited', 'unavailable'])(
		'leaves no rows when GitHub is %s',
		async (failure) => {
			if (failure === 'private') {
				vi.mocked(octokit.rest.repos.get).mockResolvedValueOnce({
					data: { private: true },
				} as GithubResult)
			} else {
				vi.mocked(octokit.rest.repos.get).mockRejectedValueOnce(
					failure === 'unavailable'
						? new Error('offline')
						: new RequestError(
								'GitHub failed',
								failure === 'missing' ? 404 : 429,
								{
									request: {
										method: 'GET',
										url: 'https://api.github.com/repos/review/example',
										headers: {},
									},
								}
							)
				)
			}
			await expect(
				client('user').submission.create(input())
			).rejects.toMatchObject({
				code:
					failure === 'private'
						? 'BAD_REQUEST'
						: failure === 'missing'
							? 'NOT_FOUND'
							: failure === 'rate limited'
								? 'TOO_MANY_REQUESTS'
								: 'INTERNAL_SERVER_ERROR',
			})
			expect(await scope.db.select().from(project)).toEqual([])
			expect(await scope.db.select().from(githubRepository)).toEqual([])
			expect(await scope.db.select().from(auditLog)).toEqual([])
		}
	)
	it.each(['draft', 'published', 'rejected', 'removed'] as const)(
		'rejects resubmission of %s projects without altering the record',
		async (status) => {
			const first = await client('user').submission.create(input())
			await scope.db
				.update(project)
				.set({ status })
				.where(eq(project.id, first.id))
			const before = await scope.db.select().from(project)
			await expect(
				client('admin').submission.create({
					...input('https://github.com/REVIEW/Example.GIT'),
					name: 'Replacement',
				})
			).rejects.toMatchObject({ code: 'CONFLICT' })
			expect(await scope.db.select().from(project)).toEqual(before)
		}
	)
	it('detects a legacy case/.git variant and enforces the database constraint', async () => {
		await scope.db.insert(project).values({
			name: 'Legacy',
			slug: 'legacy',
			repositoryUrl: 'http://www.GitHub.com/REVIEW/EXAMPLE.git/',
			status: 'rejected',
		})
		await expect(
			client('user').submission.create(input())
		).rejects.toMatchObject({ code: 'CONFLICT' })
		await expect(
			scope.db.insert(project).values({
				name: 'Duplicate',
				slug: 'duplicate',
				repositoryUrl: 'https://github.com/review/example',
				status: 'draft',
			})
		).rejects.toHaveProperty('cause.code', '23505')
	})
	it('allows exactly one winner for concurrent canonical duplicates', async () => {
		const results = await Promise.allSettled([
			client('user').submission.create(input()),
			client('user').submission.create(
				input('https://github.com/REVIEW/EXAMPLE.git')
			),
		])
		expect(
			results.filter((result) => result.status === 'fulfilled')
		).toHaveLength(1)
		expect(
			results.find((result) => result.status === 'rejected')
		).toMatchObject({ reason: { code: 'CONFLICT' } })
		expect(await scope.db.select().from(project)).toHaveLength(1)
		expect(await scope.db.select().from(githubRepository)).toHaveLength(1)
		expect(await scope.db.select().from(auditLog)).toHaveLength(1)
	})
	it('suffixes colliding slugs, including concurrent different repositories', async () => {
		await Promise.all([
			client('user').submission.create(input('review/one')),
			client('user').submission.create(input('review/two')),
		])
		expect(
			(await scope.db.select().from(project)).map((row) => row.slug).toSorted()
		).toEqual(['review-tool', 'review-tool-2'])
	})
	it('rolls back the project and metadata if the audit insert fails', async () => {
		await scope.pool.query(
			"CREATE FUNCTION fail_submission_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic audit failure'; END $$"
		)
		await scope.pool.query(
			'CREATE TRIGGER fail_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION fail_submission_audit()'
		)
		try {
			await expect(
				client('user').submission.create(input())
			).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' })
			expect(await scope.db.select().from(project)).toEqual([])
			expect(await scope.db.select().from(githubRepository)).toEqual([])
		} finally {
			await scope.pool.query('DROP TRIGGER fail_audit ON audit_log')
			await scope.pool.query('DROP FUNCTION fail_submission_audit()')
		}
	})
})

describe('admin review', () => {
	it('keeps rename copies separate so a stale attempt cannot delete the winning media', async () => {
		const draft = await client('user').submission.create(input())
		await client('admin').admin.project.update({
			params: { id: draft.id },
			body: complete,
		})
		const copied = Promise.withResolvers<void>()
		const release = Promise.withResolvers<void>()
		let copies = 0
		vi.mocked(storage.copyS3Object).mockImplementation(async () => {
			copies += 1
			if (copies === 2) copied.resolve()
			await release.promise
		})
		vi.mocked(storage.deleteFinalKeysBestEffort).mockClear()
		const edits = Promise.allSettled([
			client('admin').admin.project.update({
				params: { id: draft.id },
				body: { slug: 'renamed-tool' },
			}),
			client('admin').admin.project.update({
				params: { id: draft.id },
				body: { slug: 'renamed-tool' },
			}),
		])
		await copied.promise
		expect(
			new Set(
				vi.mocked(storage.copyS3Object).mock.calls.map(([, target]) => target)
			).size
		).toBe(2)
		release.resolve()
		const results = await edits
		expect(
			results.filter((result) => result.status === 'fulfilled')
		).toHaveLength(1)
		expect(
			results.find((result) => result.status === 'rejected')
		).toMatchObject({ reason: { code: 'CONFLICT' } })
		const winner = await client('admin').admin.project.getById({
			params: { id: draft.id },
		})
		expect(winner.slug).toBe('renamed-tool')
		expect(
			vi
				.mocked(storage.deleteFinalKeysBestEffort)
				.mock.calls.flatMap(([keys]) => keys)
		).not.toContain(winner.logo)
	})
	it('rechecks leaf categories after media work and cleans promoted uploads if the hierarchy changed', async () => {
		const draft = await client('user').submission.create(input())
		const started = Promise.withResolvers<void>()
		const release = Promise.withResolvers<void>()
		vi.mocked(storage.promoteTempImageToProject).mockImplementationOnce(
			async ({ slug }) => {
				started.resolve()
				await release.promise
				return `projects/${slug}/logo-550e8400-e29b-41d4-a716-446655440000.png`
			}
		)
		const pending = client('admin').admin.project.update({
			params: { id: draft.id },
			body: { ...complete, status: 'published' },
		})
		const outcome = pending.then(
			(value) => {
				return { value }
			},
			(error: unknown) => {
				return { error }
			}
		)
		let childId = ''
		try {
			await started.promise
			const [backend] = await scope.db
				.select()
				.from(category)
				.where(eq(category.slug, 'backend'))
			const child = await client('admin').admin.category.create({
				body: {
					slug: 'changed-leaf',
					name: 'Changed leaf',
					description: 'Synthetic child created during media preparation.',
					parentId: backend!.id,
				},
			})
			childId = child.id
		} finally {
			release.resolve()
		}
		try {
			expect(await outcome).toMatchObject({
				error: { code: 'UPLOAD_CONSUMED' },
			})
			expect(
				await client('admin').admin.project.getById({
					params: { id: draft.id },
				})
			).toMatchObject({ status: 'draft', logo: null, categories: [] })
			expect(storage.deleteFinalKeysBestEffort).toHaveBeenCalledWith([
				'projects/review-tool/logo-550e8400-e29b-41d4-a716-446655440000.png',
			])
		} finally {
			if (childId) {
				await client('admin').admin.category.remove({ params: { id: childId } })
			}
		}
	})
	it('uses resolved GitHub identity in admin create/update and blocks aliases owned by another project before promotion', async () => {
		vi.mocked(octokit.rest.repos.get).mockResolvedValue({
			data: {
				private: false,
				owner: { login: 'current' },
				name: 'one',
				stargazers_count: 2,
				forks_count: 1,
			},
		} as GithubResult)
		const first = await client('admin').admin.project.create({
			body: { ...input('old/one'), slug: 'current-one', status: 'draft' },
		})
		expect(first).toMatchObject({
			repositoryUrl: 'https://github.com/current/one',
			github: { owner: 'current', repo: 'one' },
		})
		await expect(
			client('admin').admin.project.create({
				body: { ...input('other/one'), slug: 'duplicate', ...complete },
			})
		).rejects.toMatchObject({ code: 'CONFLICT' })
		vi.mocked(octokit.rest.repos.get).mockResolvedValueOnce({
			data: {
				private: false,
				owner: { login: 'current' },
				name: 'two',
				stargazers_count: 4,
				forks_count: 2,
			},
		} as GithubResult)
		const second = await client('user').submission.create(input('old/two'))
		await expect(
			client('admin').admin.project.update({
				params: { id: second.id },
				body: { repositoryUrl: 'alias/one', logo: complete.logo },
			})
		).rejects.toMatchObject({ code: 'CONFLICT' })
		expect(storage.promoteTempImageToProject).not.toHaveBeenCalled()
		vi.mocked(octokit.rest.repos.get).mockResolvedValueOnce({
			data: {
				private: false,
				owner: { login: 'TransferredOrg' },
				name: 'NewName',
				stargazers_count: 6,
				forks_count: 3,
			},
		} as GithubResult)
		expect(
			await client('admin').admin.project.update({
				params: { id: second.id },
				body: { repositoryUrl: 'older/renamed' },
			})
		).toMatchObject({
			repositoryUrl: 'https://github.com/transferredorg/newname',
			github: { owner: 'transferredorg', repo: 'newname', stars: 6, forks: 3 },
		})
	})
	it.each(['github', 'promotion'] as const)(
		'does not hold category or project locks during %s and rejects concurrent edits',
		async (operation) => {
			const draft = await client('user').submission.create(input())
			const [before] = await scope.db
				.select()
				.from(project)
				.where(eq(project.id, draft.id))
			const started = Promise.withResolvers<void>()
			const release = Promise.withResolvers<void>()
			if (operation === 'github') {
				vi.mocked(octokit.rest.repos.get).mockImplementationOnce(async () => {
					started.resolve()
					await release.promise
					return {
						data: {
							private: false,
							owner: { login: 'review' },
							name: 'changed',
							stargazers_count: 1,
							forks_count: 1,
						},
					} as GithubResult
				})
			} else {
				vi.mocked(storage.promoteTempImageToProject).mockImplementationOnce(
					async ({ slug }) => {
						started.resolve()
						await release.promise
						return `projects/${slug}/logo-550e8400-e29b-41d4-a716-446655440000.png`
					}
				)
			}
			const pending = client('admin').admin.project.update({
				params: { id: draft.id },
				body:
					operation === 'github'
						? { repositoryUrl: 'review/changed' }
						: { ...complete, status: 'published' },
			})
			const outcome = pending.then(
				(value) => {
					return { value }
				},
				(error: unknown) => {
					return { error }
				}
			)
			try {
				await started.promise
				await scope.db.transaction(async (tx) => {
					await tx.execute(sql`SET LOCAL lock_timeout = '1s'`)
					await lockCategoryIntegrity(tx)
					await tx
						.select()
						.from(project)
						.where(eq(project.id, draft.id))
						.for('update')
					// Keep the timestamp identical: the row version still detects this edit.
					await tx
						.update(project)
						.set({ name: 'Concurrent edit', updatedAt: before!.updatedAt })
						.where(eq(project.id, draft.id))
				})
			} finally {
				release.resolve()
			}
			expect(await outcome).toMatchObject({
				error: {
					code: operation === 'github' ? 'CONFLICT' : 'UPLOAD_CONSUMED',
				},
			})
			expect(
				await client('admin').admin.project.getById({
					params: { id: draft.id },
				})
			).toMatchObject({
				name: 'Concurrent edit',
				repositoryUrl: 'https://github.com/review/example',
				status: 'draft',
				logo: null,
			})
			expect(storage.deleteFinalKeysBestEffort).toHaveBeenCalledWith(
				operation === 'promotion'
					? [
							`projects/review-tool/logo-550e8400-e29b-41d4-a716-446655440000.png`,
						]
					: []
			)
		}
	)
	it('saves an incomplete admin draft without assigning a submitter', async () => {
		const result = await client('admin').admin.project.create({
			body: { ...input(), slug: 'admin-draft', status: 'draft' },
		})
		expect(result).toMatchObject({
			status: 'draft',
			tagline: null,
			description: null,
			logo: null,
			categories: [],
			submitterId: null,
			submitter: null,
		})
		expect(storage.promoteTempImageToProject).not.toHaveBeenCalled()
	})
	it('blocks default published creation before consuming uploads when incomplete', async () => {
		await expect(
			client('admin').admin.project.create({
				body: { ...input(), slug: 'incomplete', logo: complete.logo },
			})
		).rejects.toMatchObject({ code: 'BAD_REQUEST' })
		expect(storage.promoteTempImageToProject).not.toHaveBeenCalled()
		expect(await scope.db.select().from(project)).toEqual([])
	})
	it('saves partial draft content and rejects both status-only and upload-bearing incomplete publish', async () => {
		const draft = await client('user').submission.create(input())
		const result = await client('admin').admin.project.update({
			params: { id: draft.id },
			body: { tagline: 'Work in progress', description: '', categorySlugs: [] },
		})
		expect(result).toMatchObject({
			status: 'draft',
			tagline: 'Work in progress',
			description: null,
			categories: [],
		})
		for (const body of [
			{ status: 'published' as const },
			{ status: 'published' as const, logo: complete.logo },
		]) {
			await expect(
				client('admin').admin.project.update({ params: { id: draft.id }, body })
			).rejects.toMatchObject({ code: 'BAD_REQUEST' })
		}
		expect(storage.promoteTempImageToProject).not.toHaveBeenCalled()
	})
	it('publishes merged final state and keeps submitter identity out of public responses', async () => {
		const draft = await client('user').submission.create(input())
		await client('admin').admin.project.update({
			params: { id: draft.id },
			body: complete,
		})
		const published = await client('admin').admin.project.update({
			params: { id: draft.id },
			body: { status: 'published' },
		})
		expect(published.status).toBe('published')
		expect(published.submitterId).toBe(submitterId)
		const publicDetail = await client(null).project.getBySlug({
			params: { slug: published.slug },
		})
		expect(publicDetail).not.toHaveProperty('submitterId')
		expect(publicDetail).not.toHaveProperty('submitter')
		expect(publicDetail).not.toHaveProperty('rejectionReason')
		const publicList = await client(null).project.list({ query: {} })
		expect(publicList.projects[0]).not.toHaveProperty('submitterId')
		const search = await client(null).project.search({ query: { q: 'Review' } })
		expect(search.projects[0]).not.toHaveProperty('submitterId')
	})
	it.each([
		{ tagline: null },
		{ description: '' },
		{ logo: null },
		{ categorySlugs: [] },
	])(
		'prevents incomplete published updates %j even with no status field',
		async (body) => {
			const published = await client('admin').admin.project.create({
				body: { ...input(), slug: 'published', ...complete },
			})
			vi.mocked(storage.promoteTempImageToProject).mockClear()
			await expect(
				client('admin').admin.project.update({
					params: { id: published.id },
					body,
				})
			).rejects.toMatchObject({ code: 'BAD_REQUEST' })
			expect(
				(
					await client('admin').admin.project.getById({
						params: { id: published.id },
					})
				).status
			).toBe('published')
			expect(storage.promoteTempImageToProject).not.toHaveBeenCalled()
		}
	)
	it.each(['missing-category', 'developer-tools'])(
		'requires valid leaf category %s before upload promotion',
		async (slug) => {
			const draft = await client('user').submission.create(input())
			await expect(
				client('admin').admin.project.update({
					params: { id: draft.id },
					body: { ...complete, categorySlugs: [slug], status: 'published' },
				})
			).rejects.toMatchObject({ code: 'BAD_REQUEST' })
			expect(storage.promoteTempImageToProject).not.toHaveBeenCalled()
		}
	)
	it('rejects with reason, restores and unpublishes with auditable transitions', async () => {
		const draft = await client('user').submission.create(input())
		const params = { id: draft.id }
		expect(
			await client('admin').admin.project.update({
				params,
				body: {
					status: 'rejected',
					rejectionReason: '  Needs a clearer README  ',
				},
			})
		).toMatchObject({
			status: 'rejected',
			rejectionReason: 'Needs a clearer README',
		})
		expect(
			await client('admin').admin.project.update({
				params,
				body: { status: 'draft' },
			})
		).toMatchObject({ status: 'draft', rejectionReason: null })
		await client('admin').admin.project.update({
			params,
			body: { ...complete, status: 'published' },
		})
		expect(
			await client('admin').admin.project.update({
				params,
				body: { status: 'draft' },
			})
		).toMatchObject({ status: 'draft' })
		const events = await scope.db
			.select()
			.from(auditLog)
			.where(eq(auditLog.action, 'project_status_changed'))
		expect(events).toHaveLength(4)
		expect(events).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					reason: 'Needs a clearer README',
					metadata: { fromStatus: 'draft', toStatus: 'rejected' },
				}),
			])
		)
	})
	it.each(['draft', 'rejected', 'removed'] as const)(
		'hides %s projects from detail, listing, search and category counts',
		async (status) => {
			const draft = await client('user').submission.create(input())
			await client('admin').admin.project.update({
				params: { id: draft.id },
				body: { status, categorySlugs: ['backend'] },
			})
			await expect(
				client(null).project.getBySlug({ params: { slug: 'review-tool' } })
			).rejects.toMatchObject({ code: 'NOT_FOUND' })
			expect((await client(null).project.list({ query: {} })).projects).toEqual(
				[]
			)
			expect(
				(await client(null).project.search({ query: { q: 'Review' } })).projects
			).toEqual([])
			expect(
				(await client(null).project.search({ query: { category: 'backend' } }))
					.projects
			).toEqual([])
			const categories = await client(null).category.list({})
			expect(
				categories.categories.find((node) => node.slug === 'backend')
					?.projectCount ?? 0
			).toBe(0)
		}
	)
	it('renames and deletes a draft without trying to copy or delete a missing logo', async () => {
		const draft = await client('user').submission.create(input())
		await client('admin').admin.project.update({
			params: { id: draft.id },
			body: { slug: 'renamed' },
		})
		await client('admin').admin.project.remove({ params: { id: draft.id } })
		expect(storage.copyS3Object).not.toHaveBeenCalled()
		expect(storage.deleteFinalKeysBestEffort).toHaveBeenLastCalledWith([])
		expect(await scope.db.select().from(githubRepository)).toEqual([])
		expect(await scope.db.select().from(projectCategory)).toEqual([])
	})
	it.each([null, 'user'] as const)(
		'protects all review endpoints from role %s',
		async (role) => {
			const reviewer = client(role).admin.project
			const params = { id: '550e8400-e29b-41d4-a716-446655440000' }
			for (const request of [
				reviewer.list({ query: {} }),
				reviewer.getById({ params }),
				reviewer.update({ params, body: { status: 'rejected' } }),
				reviewer.remove({ params }),
				reviewer.create({
					body: { ...input(), slug: 'protected', status: 'draft' },
				}),
				reviewer.listCategories({}),
			]) {
				await expect(request).rejects.toMatchObject({
					code: role === null ? 'UNAUTHORIZED' : 'FORBIDDEN',
				})
			}
		}
	)
})
