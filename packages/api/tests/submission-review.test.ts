import { createRouterClient } from '@orpc/server'
import { eq } from 'drizzle-orm'
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
import { routers } from '@altstack/api/routers'
import * as storage from '@altstack/api/storage'

import {
	auditLog,
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
	vi.spyOn(storage, 'promoteTempImageToProject')
	vi.spyOn(storage, 'copyS3Object').mockResolvedValue(undefined)
	vi.spyOn(storage, 'deleteFinalKeysBestEffort').mockResolvedValue(undefined)
}, 60_000)

beforeEach(async () => {
	await scope.db.delete(auditLog)
	await scope.db.delete(project)
	vi.mocked(octokit.rest.repos.get)
		.mockReset()
		.mockResolvedValue({
			data: { private: false, stargazers_count: 0, forks_count: 2 },
		} as unknown as GithubResult)
	vi.mocked(storage.promoteTempImageToProject)
		.mockReset()
		.mockImplementation(({ slug, kind }) =>
			Promise.resolve(
				`projects/${slug}/${kind}-550e8400-e29b-41d4-a716-446655440000.png`
			)
		)
	vi.mocked(storage.copyS3Object).mockClear()
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
