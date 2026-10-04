import { createRouterClient } from '@orpc/server'
import { eq, inArray } from 'drizzle-orm'
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

import { db } from '@altstack/db'
import { auditLog, category, project, user } from '@altstack/db/schemas'

const TEST_TIMEOUT = 30_000
const MISSING_ID = '550e8400-e29b-41d4-a716-446655440000'
const MOCK_STARS = 123
const MOCK_FORKS = 45

// Unique prefix so fixtures never collide with seed data or other suites.
const PREFIX = 'test-cu'

type OctokitGetResult = Awaited<ReturnType<typeof octokit.rest.repos.get>>

function clientWith(auth: ORPCContext['auth']) {
	return createRouterClient(routers, {
		context: { db, auth },
	})
}

// Reassigned in beforeAll once the fixture admin user exists (audit rows
// reference user.id, so writes need a real actor).
let adminClient = clientWith({
	user: { id: MISSING_ID, role: 'admin' },
} as unknown as ORPCContext['auth'])
const userClient = clientWith({
	user: { id: MISSING_ID, role: 'user' },
} as unknown as ORPCContext['auth'])
const anonClient = clientWith(null)

function uniqueSuffix() {
	return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
		.toLowerCase()
		.replaceAll(/[^a-z0-9]/g, '')
}

function tmpLogoKey(suffix: string) {
	return `tmp/logos/${PREFIX}-${suffix}-1.png`
}

function tmpScreenshotKey(suffix: string) {
	return `tmp/screenshots/${PREFIX}-${suffix}-1.png`
}

// Real S3/GitHub are never touched: storage + octokit are spied, Postgres is
// real so unique-constraint races behave like production.
let promoteCounter = 0
function nextUuid() {
	promoteCounter += 1
	return `123e4567-e89b-12d3-a456-42661417${String(promoteCounter % 10_000).padStart(4, '0')}`
}

function mockGithubRepoGet() {
	vi.mocked(octokit.rest.repos.get).mockReset()
	vi.mocked(octokit.rest.repos.get).mockImplementation(() =>
		Promise.resolve({
			data: { stargazers_count: MOCK_STARS, forks_count: MOCK_FORKS },
		} as unknown as OctokitGetResult)
	)
}

function mockStorageDefaults() {
	vi.mocked(storage.promoteTempImageToProject).mockReset()
	vi.mocked(storage.promoteTempImageToProject).mockImplementation(
		({ slug, kind }) =>
			Promise.resolve(
				`projects/${slug}/${kind === 'logo' ? 'logo' : 'screenshot'}-${nextUuid()}.png`
			)
	)
	vi.mocked(storage.copyS3Object).mockReset()
	vi.mocked(storage.copyS3Object).mockResolvedValue(undefined)
	vi.mocked(storage.deleteFinalKeysBestEffort).mockReset()
	vi.mocked(storage.deleteFinalKeysBestEffort).mockResolvedValue(undefined)
}

const createdProjectIds: Array<string> = []
let adminUserId = ''

async function createFixtureProject(
	suffix: string,
	overrides: { screenshot?: boolean } = {}
) {
	const slug = `${PREFIX}-${suffix}`
	const result = await adminClient.admin.project.create({
		name: `Test CU ${suffix}`,
		slug,
		repositoryUrl: `https://github.com/${PREFIX}-owner/${PREFIX}-repo-${suffix}`,
		tagline: `Tagline for ${suffix}`,
		description: `Description for ${suffix}`,
		logo: tmpLogoKey(suffix),
		...(overrides.screenshot ? { screenshot: tmpScreenshotKey(suffix) } : {}),
		categorySlugs: ['backend'],
	})
	createdProjectIds.push(result.id)
	return result
}

// Direct row insert without API side effects (no promote, no audit). Used to
// simulate a race winner that lands between preflight and the transaction.
// Draft status keeps public-search counts untouched on the shared dev DB.
async function insertDirectProject(slug: string, repositoryUrl: string) {
	const [row] = await db
		.insert(project)
		.values({
			name: `Race ${slug}`,
			slug,
			repositoryUrl,
			tagline: 'Race tagline',
			description: 'Race description',
			logo: 'race-logo',
			status: 'draft',
		})
		.returning({ id: project.id })

	if (!row) throw new Error(`Failed to insert direct project ${slug}`)
	createdProjectIds.push(row.id)
	return row.id
}

function clearStorageMocks() {
	vi.mocked(storage.promoteTempImageToProject).mockClear()
	vi.mocked(storage.copyS3Object).mockClear()
	vi.mocked(storage.deleteFinalKeysBestEffort).mockClear()
}

beforeAll(async () => {
	await db
		.insert(category)
		.values({
			slug: 'backend',
			name: 'Backend',
			description: 'Servers, APIs, and server-side frameworks.',
		})
		.onConflictDoNothing({ target: category.slug })

	const [adminUser] = await db
		.insert(user)
		.values({
			name: 'Test CU Admin',
			email: `${PREFIX}-admin-${uniqueSuffix()}@example.com`,
			role: 'admin',
		})
		.returning({ id: user.id })

	if (!adminUser) throw new Error('Failed to insert fixture admin user')
	adminUserId = adminUser.id
	adminClient = clientWith({
		user: { id: adminUserId, role: 'admin' },
	} as unknown as ORPCContext['auth'])

	vi.spyOn(octokit.rest.repos, 'get')
	vi.spyOn(storage, 'promoteTempImageToProject')
	vi.spyOn(storage, 'copyS3Object')
	vi.spyOn(storage, 'deleteFinalKeysBestEffort')
})

beforeEach(() => {
	promoteCounter = 0
	mockGithubRepoGet()
	mockStorageDefaults()
})

afterAll(async () => {
	vi.restoreAllMocks()

	if (createdProjectIds.length > 0) {
		await db.delete(project).where(inArray(project.id, createdProjectIds))
		createdProjectIds.length = 0
	}

	if (adminUserId) {
		await db.delete(auditLog).where(eq(auditLog.actorId, adminUserId))
		await db.delete(user).where(eq(user.id, adminUserId))
		adminUserId = ''
	}
})

describe('admin create project', () => {
	it(
		'creates a project with promoted logo and screenshot',
		{ timeout: TEST_TIMEOUT },
		async () => {
			const suffix = uniqueSuffix()
			const slug = `${PREFIX}-${suffix}`
			const logoTmp = tmpLogoKey(suffix)
			const screenshotTmp = tmpScreenshotKey(suffix)

			const result = await adminClient.admin.project.create({
				name: `Test CU ${suffix}`,
				slug,
				repositoryUrl: `https://github.com/${PREFIX}-owner/${PREFIX}-repo-${suffix}`,
				tagline: `Tagline for ${suffix}`,
				description: `Description for ${suffix}`,
				logo: logoTmp,
				screenshot: screenshotTmp,
				categorySlugs: ['backend'],
			})
			createdProjectIds.push(result.id)

			expect(result.slug).toBe(slug)
			expect(result.status).toBe('published')
			expect(result.logo).toMatch(
				new RegExp(`^projects/${slug}/logo-.+\\.png$`)
			)
			expect(result.screenshot).toMatch(
				new RegExp(`^projects/${slug}/screenshot-.+\\.png$`)
			)
			expect(result.categories).toEqual(['backend'])
			expect(result.github).toMatchObject({
				owner: `${PREFIX}-owner`,
				repo: `${PREFIX}-repo-${suffix}`,
				stars: MOCK_STARS,
				forks: MOCK_FORKS,
			})

			const promoteMock = vi.mocked(storage.promoteTempImageToProject)
			expect(promoteMock).toHaveBeenCalledTimes(2)
			expect(promoteMock).toHaveBeenNthCalledWith(1, {
				tmpKey: logoTmp,
				slug,
				kind: 'logo',
			})
			expect(promoteMock).toHaveBeenNthCalledWith(2, {
				tmpKey: screenshotTmp,
				slug,
				kind: 'screenshot',
			})

			const [row] = await db
				.select()
				.from(project)
				.where(eq(project.id, result.id))
			expect(row?.slug).toBe(slug)
			expect(row?.logo).toBe(result.logo)
			expect(row?.status).toBe('published')
		}
	)

	it(
		'creates a project with logo only and null screenshot',
		{ timeout: TEST_TIMEOUT },
		async () => {
			const suffix = uniqueSuffix()
			const slug = `${PREFIX}-${suffix}`

			const result = await createFixtureProject(suffix)

			expect(result.slug).toBe(slug)
			expect(result.screenshot).toBeNull()
			expect(
				vi.mocked(storage.promoteTempImageToProject)
			).toHaveBeenCalledTimes(1)
		}
	)

	it(
		'rejects duplicate slug or repository with CONFLICT before promoting',
		{ timeout: TEST_TIMEOUT },
		async () => {
			const suffix = uniqueSuffix()
			const fixture = await createFixtureProject(suffix)
			clearStorageMocks()
			const promoteMock = vi.mocked(storage.promoteTempImageToProject)

			const base = {
				name: `Test CU dup ${suffix}`,
				tagline: `Tagline dup ${suffix}`,
				description: `Description dup ${suffix}`,
				logo: tmpLogoKey(`dup-${suffix}`),
				categorySlugs: ['backend'],
			}

			await expect(
				adminClient.admin.project.create({
					...base,
					slug: fixture.slug,
					repositoryUrl: `https://github.com/${PREFIX}-owner/${PREFIX}-repo-dup-${suffix}`,
				})
			).rejects.toMatchObject({ code: 'CONFLICT' })

			await expect(
				adminClient.admin.project.create({
					...base,
					slug: `${PREFIX}-other-${suffix}`,
					repositoryUrl: `https://github.com/${PREFIX}-owner/${PREFIX}-repo-${suffix}`,
				})
			).rejects.toMatchObject({ code: 'CONFLICT' })

			expect(promoteMock).not.toHaveBeenCalled()
		}
	)

	it(
		'surfaces CONFLICT_AFTER_PROMOTE when the slug is taken after promote',
		{ timeout: TEST_TIMEOUT },
		async () => {
			const suffix = uniqueSuffix()
			const slug = `${PREFIX}-${suffix}`
			const repositoryUrl = `https://github.com/${PREFIX}-owner/${PREFIX}-repo-${suffix}`
			const promoteMock = vi.mocked(storage.promoteTempImageToProject)
			const deleteMock = vi.mocked(storage.deleteFinalKeysBestEffort)

			let promotedKey = ''
			promoteMock.mockImplementationOnce(async ({ slug: targetSlug }) => {
				// Simulate a concurrent request winning the slug after preflight.
				await insertDirectProject(
					targetSlug,
					`https://github.com/${PREFIX}-race/race-${suffix}`
				)
				promotedKey = `projects/${targetSlug}/logo-${nextUuid()}.png`
				return promotedKey
			})

			await expect(
				adminClient.admin.project.create({
					name: `Test CU ${suffix}`,
					slug,
					repositoryUrl,
					tagline: `Tagline for ${suffix}`,
					description: `Description for ${suffix}`,
					logo: tmpLogoKey(suffix),
					categorySlugs: ['backend'],
				})
			).rejects.toMatchObject({ code: 'CONFLICT_AFTER_PROMOTE' })

			expect(promoteMock).toHaveBeenCalled()
			expect(deleteMock).toHaveBeenCalledWith([promotedKey])

			const leftovers = await db
				.select({ id: project.id })
				.from(project)
				.where(eq(project.repositoryUrl, repositoryUrl))
			expect(leftovers).toEqual([])
		}
	)

	it(
		'maps a missing tmp upload to UPLOAD_EXPIRED',
		{ timeout: TEST_TIMEOUT },
		async () => {
			const suffix = uniqueSuffix()
			vi.mocked(storage.promoteTempImageToProject).mockRejectedValueOnce(
				new storage.TempUploadMissingError()
			)

			await expect(
				adminClient.admin.project.create({
					name: `Test CU ${suffix}`,
					slug: `${PREFIX}-${suffix}`,
					repositoryUrl: `https://github.com/${PREFIX}-owner/${PREFIX}-repo-${suffix}`,
					tagline: `Tagline for ${suffix}`,
					description: `Description for ${suffix}`,
					logo: tmpLogoKey(suffix),
					categorySlugs: ['backend'],
				})
			).rejects.toMatchObject({ code: 'UPLOAD_EXPIRED' })
		}
	)

	it(
		'rejects invalid repository urls and unknown categories with BAD_REQUEST',
		{ timeout: TEST_TIMEOUT },
		async () => {
			const suffix = uniqueSuffix()
			const valid = {
				name: `Test CU ${suffix}`,
				tagline: `Tagline for ${suffix}`,
				description: `Description for ${suffix}`,
				logo: tmpLogoKey(suffix),
				categorySlugs: ['backend'],
			}

			await expect(
				adminClient.admin.project.create({
					...valid,
					slug: `${PREFIX}-${suffix}`,
					repositoryUrl: 'not-a-url',
				})
			).rejects.toMatchObject({ code: 'BAD_REQUEST' })

			await expect(
				adminClient.admin.project.create({
					...valid,
					slug: `${PREFIX}-badcat-${suffix}`,
					repositoryUrl: `https://github.com/${PREFIX}-owner/${PREFIX}-repo-badcat-${suffix}`,
					categorySlugs: ['no-such-category'],
				})
			).rejects.toMatchObject({ code: 'BAD_REQUEST' })

			expect(
				vi.mocked(storage.promoteTempImageToProject)
			).not.toHaveBeenCalled()
		}
	)
})

describe('admin update project', () => {
	it(
		'promotes a replacement logo into the same slug and deletes the old key',
		{ timeout: TEST_TIMEOUT },
		async () => {
			const suffix = uniqueSuffix()
			const created = await createFixtureProject(suffix)
			const oldLogo = created.logo
			clearStorageMocks()

			const promoteMock = vi.mocked(storage.promoteTempImageToProject)
			const copyMock = vi.mocked(storage.copyS3Object)
			const deleteMock = vi.mocked(storage.deleteFinalKeysBestEffort)

			const newTmp = tmpLogoKey(`new-${suffix}`)
			const updated = await adminClient.admin.project.update({
				id: created.id,
				logo: newTmp,
			})

			expect(updated.logo).toMatch(
				new RegExp(`^projects/${created.slug}/logo-.+\\.png$`)
			)
			expect(updated.logo).not.toBe(oldLogo)
			expect(promoteMock).toHaveBeenCalledTimes(1)
			expect(promoteMock).toHaveBeenCalledWith({
				tmpKey: newTmp,
				slug: created.slug,
				kind: 'logo',
			})
			expect(copyMock).not.toHaveBeenCalled()
			expect(deleteMock).toHaveBeenCalledWith([oldLogo])
		}
	)

	it(
		'moves kept images on slug rename via copy',
		{ timeout: TEST_TIMEOUT },
		async () => {
			const suffix = uniqueSuffix()
			const created = await createFixtureProject(suffix, { screenshot: true })
			const oldLogo = created.logo
			const oldScreenshot = created.screenshot
			clearStorageMocks()

			const promoteMock = vi.mocked(storage.promoteTempImageToProject)
			const copyMock = vi.mocked(storage.copyS3Object)
			const deleteMock = vi.mocked(storage.deleteFinalKeysBestEffort)

			const newSlug = `${PREFIX}-renamed-${suffix}`
			const updated = await adminClient.admin.project.update({
				id: created.id,
				slug: newSlug,
			})

			expect(updated.slug).toBe(newSlug)
			expect(updated.logo).toMatch(
				new RegExp(`^projects/${newSlug}/logo-.+\\.png$`)
			)
			expect(updated.screenshot).toMatch(
				new RegExp(`^projects/${newSlug}/screenshot-.+\\.png$`)
			)
			expect(promoteMock).not.toHaveBeenCalled()
			expect(copyMock).toHaveBeenCalledTimes(2)
			expect(copyMock).toHaveBeenCalledWith(oldLogo, updated.logo)
			expect(copyMock).toHaveBeenCalledWith(oldScreenshot, updated.screenshot)
			expect(deleteMock).toHaveBeenCalledWith([oldLogo, oldScreenshot])

			const [row] = await db
				.select()
				.from(project)
				.where(eq(project.id, created.id))
			expect(row?.slug).toBe(newSlug)
			expect(row?.logo).toBe(updated.logo)
		}
	)

	it(
		'promotes a new logo straight into the renamed slug without copying it',
		{ timeout: TEST_TIMEOUT },
		async () => {
			const suffix = uniqueSuffix()
			const created = await createFixtureProject(suffix)
			clearStorageMocks()

			const promoteMock = vi.mocked(storage.promoteTempImageToProject)
			const copyMock = vi.mocked(storage.copyS3Object)
			const deleteMock = vi.mocked(storage.deleteFinalKeysBestEffort)

			const newSlug = `${PREFIX}-renamed-${suffix}`
			const newTmp = tmpLogoKey(`new-${suffix}`)
			const updated = await adminClient.admin.project.update({
				id: created.id,
				slug: newSlug,
				logo: newTmp,
			})

			expect(updated.slug).toBe(newSlug)
			expect(updated.logo).toMatch(
				new RegExp(`^projects/${newSlug}/logo-.+\\.png$`)
			)
			expect(promoteMock).toHaveBeenCalledTimes(1)
			expect(promoteMock).toHaveBeenCalledWith({
				tmpKey: newTmp,
				slug: newSlug,
				kind: 'logo',
			})
			expect(copyMock).not.toHaveBeenCalled()
			expect(deleteMock).toHaveBeenCalledWith([created.logo])
		}
	)

	it(
		'surfaces CONFLICT_AFTER_PROMOTE when the slug is taken after tmp promote',
		{ timeout: TEST_TIMEOUT },
		async () => {
			const suffix = uniqueSuffix()
			const created = await createFixtureProject(suffix)
			clearStorageMocks()

			const promoteMock = vi.mocked(storage.promoteTempImageToProject)
			const deleteMock = vi.mocked(storage.deleteFinalKeysBestEffort)

			const newSlug = `${PREFIX}-race-${suffix}`
			let promotedKey = ''
			promoteMock.mockImplementationOnce(async ({ slug: targetSlug }) => {
				await insertDirectProject(
					targetSlug,
					`https://github.com/${PREFIX}-race/race-taken-${suffix}`
				)
				promotedKey = `projects/${targetSlug}/logo-${nextUuid()}.png`
				return promotedKey
			})

			await expect(
				adminClient.admin.project.update({
					id: created.id,
					slug: newSlug,
					logo: tmpLogoKey(`new-${suffix}`),
				})
			).rejects.toMatchObject({ code: 'CONFLICT_AFTER_PROMOTE' })

			expect(deleteMock).toHaveBeenCalledWith([promotedKey])

			const [row] = await db
				.select()
				.from(project)
				.where(eq(project.id, created.id))
			expect(row?.slug).toBe(created.slug)
		}
	)

	it(
		'rejects slug rename to a taken slug with CONFLICT before promoting',
		{ timeout: TEST_TIMEOUT },
		async () => {
			const first = await createFixtureProject(`${uniqueSuffix()}`)
			const second = await createFixtureProject(`${uniqueSuffix()}`)
			clearStorageMocks()

			await expect(
				adminClient.admin.project.update({ id: first.id, slug: second.slug })
			).rejects.toMatchObject({ code: 'CONFLICT' })

			expect(
				vi.mocked(storage.promoteTempImageToProject)
			).not.toHaveBeenCalled()
			expect(vi.mocked(storage.copyS3Object)).not.toHaveBeenCalled()
		}
	)

	it(
		'accepts valid status transitions and rejects unknown statuses',
		{ timeout: TEST_TIMEOUT },
		async () => {
			const suffix = uniqueSuffix()
			const created = await createFixtureProject(suffix)

			for (const status of [
				'draft',
				'published',
				'rejected',
				'removed',
			] as const) {
				const updated = await adminClient.admin.project.update({
					id: created.id,
					status,
				})
				expect(updated.status).toBe(status)
			}

			await expect(
				adminClient.admin.project.update({
					id: created.id,
					status: 'archived' as never,
				})
			).rejects.toMatchObject({ code: 'BAD_REQUEST' })
		}
	)
})

describe('admin create/update auth', () => {
	it(
		'rejects anonymous and non-admin callers',
		{ timeout: TEST_TIMEOUT },
		async () => {
			const suffix = uniqueSuffix()
			const input = {
				name: `Test CU ${suffix}`,
				slug: `${PREFIX}-${suffix}`,
				repositoryUrl: `https://github.com/${PREFIX}-owner/${PREFIX}-repo-${suffix}`,
				tagline: `Tagline for ${suffix}`,
				description: `Description for ${suffix}`,
				logo: tmpLogoKey(suffix),
				categorySlugs: ['backend'],
			}

			await expect(
				anonClient.admin.project.create(input)
			).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
			await expect(
				userClient.admin.project.create(input)
			).rejects.toMatchObject({ code: 'FORBIDDEN' })
			await expect(
				anonClient.admin.project.update({ id: MISSING_ID })
			).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
			await expect(
				userClient.admin.project.update({ id: MISSING_ID })
			).rejects.toMatchObject({ code: 'FORBIDDEN' })
		}
	)
})
