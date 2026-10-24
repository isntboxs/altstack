import { createRouterClient } from '@orpc/server'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vite-plus/test'

import type { ORPCContext } from '@altstack/api/context'
import { claimCodeHash, enforceClaimQuota } from '@altstack/api/ownership-otp'
import { lockCategoryIntegrity } from '@altstack/api/queries/category-integrity'
import { routers } from '@altstack/api/routers'
import * as storage from '@altstack/api/storage'

import { db } from '@altstack/db'
import {
	account,
	auditLog,
	category,
	githubRepository,
	project,
	projectCategory,
	projectClaim,
	projectMember,
	projectUpload,
	user,
} from '@altstack/db/schemas'

const { sent } = vi.hoisted(() => {
	return {
		sent: vi.fn<
			(data: {
				email: string
				code: string
				role: 'owner' | 'maintainer'
				projectName: string
			}) => Promise<void>
		>(),
	}
})
vi.mock('@altstack/auth/server/project-claim-email', () => {
	return {
		sendProjectClaimEmail: sent,
	}
})
vi.mock('@aws-sdk/s3-request-presigner', () => {
	return {
		getSignedUrl: vi.fn(() =>
			Promise.resolve('https://storage.example.test/signed')
		),
	}
})

vi.mock('@altstack/auth/server/github-access-token', () => {
	return {
		getClaimGithubAccessToken: vi.fn(() =>
			Promise.resolve('synthetic-claim-github-token')
		),
	}
})
function githubResponses(respond: (url: URL) => Response | Promise<Response>) {
	vi.mocked(fetch).mockImplementation((input) =>
		Promise.resolve(
			respond(new URL(input instanceof Request ? input.url : input))
		)
	)
}
beforeEach(() => {
	vi.stubGlobal('fetch', vi.fn())
	githubResponses((url) => {
		if (url.hostname !== 'api.github.com') {
			throw new Error('No external requests in ownership tests')
		}
		if (url.pathname === '/user') {
			return Response.json({ id: 123, login: 'representative' })
		}
		return Response.json({
			id: 456,
			private: false,
			permissions: { admin: false, maintain: true, push: true, pull: true },
		})
	})
})

const projectIds: Array<string> = [],
	userIds: Array<string> = [],
	categoryIds: Array<string> = []
afterEach(async () => {
	if (projectIds.length > 0) {
		await db.delete(project).where(inArray(project.id, projectIds.splice(0)))
	}
	if (userIds.length > 0) {
		await db.delete(user).where(inArray(user.id, userIds.splice(0)))
	}
	if (categoryIds.length > 0) {
		await db.delete(category).where(inArray(category.id, categoryIds.splice(0)))
	}
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
	sent.mockReset()
})

async function fixture() {
	const token = randomUUID().replaceAll('-', '')
	const users = await db
		.insert(user)
		.values(
			['admin', 'user', 'user', 'user'].map((role, index) => {
				return {
					role,
					name: `Person ${index}`,
					email: `${token}-${index}@example.test`,
					emailVerified: true,
				}
			})
		)
		.returning()
	userIds.push(...users.map((item) => item.id))
	await db.insert(account).values(
		users.map((person) => {
			return {
				userId: person.id,
				accountId: '123',
				providerId: 'github',
			}
		})
	)
	const projects = await db
		.insert(project)
		.values(
			[0, 1].map((index) => {
				return {
					name: `Ownership ${index}`,
					slug: `ownership-${token}-${index}`,
					tagline: `${token} tagline`,
					description: 'A real project description',
					repositoryUrl: `https://github.com/ownership/${token}-${index}`,
					logo: `projects/ownership/logo-${randomUUID()}.png`,
					status: 'published' as const,
				}
			})
		)
		.returning()
	projectIds.push(...projects.map((item) => item.id))
	await db.insert(githubRepository).values(
		projects.map((item) => {
			return {
				projectId: item.id,
				owner: 'ownership',
				repo: item.slug,
				stars: 1,
				forks: 0,
				fetchedAt: new Date(),
			}
		})
	)
	const [leaf] = await db
		.insert(category)
		.values({ slug: `ownership-${token}`, name: 'Ownership leaf' })
		.returning()
	categoryIds.push(leaf!.id)
	await db.insert(projectCategory).values(
		projects.map((item) => {
			return { projectId: item.id, categoryId: leaf!.id }
		})
	)
	const clients = users.map((person) =>
		createRouterClient(routers, {
			context: {
				db,
				auth: { user: person } as unknown as ORPCContext['auth'],
				requestHeaders: new Headers({
					'x-forwarded-for': `fd00:${person.id
						.replaceAll('-', '')
						.match(/.{1,4}/g)!
						.slice(0, 7)
						.join(':')}`,
				}),
			},
		})
	)
	sent.mockResolvedValue()
	const [admin, alice, bob, other] = clients
	return {
		token,
		users,
		projects,
		leaf: leaf!,
		admin: admin!,
		alice: alice!,
		bob: bob!,
		other: other!,
		params: { id: projects[0]!.id },
		second: { id: projects[1]!.id },
		anon: createRouterClient(routers, { context: { db, auth: null } }),
	}
}
type Fixture = Awaited<ReturnType<typeof fixture>>
async function confirmed(
	f: Fixture,
	client = f.alice,
	role: 'owner' | 'maintainer' = 'owner',
	params = f.params
) {
	const email = `${randomUUID()}@example.test`
	const challenge = await client.ownership.request({
		params,
		body: { email, role },
	})
	const mail = sent.mock.calls.findLast(([data]) => data.email === email)![0]
	await client.ownership.verify({
		params,
		body: { challengeId: challenge.challengeId, code: mail.code },
	})
	const [claim] = await db
		.select()
		.from(projectClaim)
		.where(eq(projectClaim.challengeId, challenge.challengeId))
	return { claim: claim!, challenge, mail }
}
async function approved(
	f: Fixture,
	client = f.alice,
	role: 'owner' | 'maintainer' = 'owner'
) {
	const value = await confirmed(f, client, role)
	await f.admin.ownership.review({
		params: { id: value.claim.id },
		body: { decision: 'approve' },
	})
	return value
}

async function mediaUploads(f: Fixture) {
	const keys = {
		logo: `tmp/logos/claim-${randomUUID()}-${Date.now()}.png`,
		screenshot: `tmp/screenshots/claim-${randomUUID()}-${Date.now()}.png`,
	}
	await db.insert(projectUpload).values(
		Object.values(keys).map((key) => {
			return { key, projectId: f.params.id, userId: f.users[1]!.id }
		})
	)
	return keys
}

describe('project claims and scoped Better Auth roles', () => {
	it('blocks self-approval even for the first admin claimant and removes verification when the last member is deleted', async () => {
		const f = await fixture()
		const own = await confirmed(f, f.admin)
		await expect(
			f.admin.ownership.review({
				params: { id: own.claim.id },
				body: { decision: 'approve' },
			})
		).rejects.toMatchObject({ code: 'FORBIDDEN' })
		await approved(f)
		await db.delete(user).where(eq(user.id, f.users[1]!.id))
		expect(
			(
				await f.anon.project.getBySlug({
					params: { slug: f.projects[0]!.slug },
				})
			).verified
		).toBe(false)
	})
	it('limits recipient abuse across independent accounts and rejects foreign browser origins', async () => {
		const f = await fixture()
		const recipient = `${randomUUID()}@example.test`
		const people = await db
			.insert(user)
			.values(
				Array.from({ length: 6 }, (_, n) => {
					return {
						role: 'user',
						name: 'Quota fixture',
						email: `${randomUUID()}-${n}@example.test`,
					}
				})
			)
			.returning()
		userIds.push(...people.map((person) => person.id))
		await db.insert(account).values(
			people.map((person) => {
				return {
					userId: person.id,
					accountId: '123',
					providerId: 'github',
				}
			})
		)
		const clients = people.map((person) =>
			createRouterClient(routers, {
				context: {
					db,
					auth: { user: person } as unknown as ORPCContext['auth'],
					requestHeaders: new Headers({
						'x-forwarded-for': `fd01:${person.id
							.replaceAll('-', '')
							.match(/.{1,4}/g)!
							.slice(0, 7)
							.join(':')}`,
					}),
				},
			})
		)
		for (const client of clients.slice(0, 5)) {
			await client.ownership.request({
				params: f.params,
				body: { email: recipient, role: 'owner' },
			})
		}
		await expect(
			clients[5]!.ownership.request({
				params: f.params,
				body: { email: recipient, role: 'owner' },
			})
		).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' })
		expect(sent).toHaveBeenCalledTimes(5)
		const foreign = createRouterClient(routers, {
			context: {
				db,
				auth: { user: f.users[1]! } as unknown as ORPCContext['auth'],
				requestHeaders: new Headers({ origin: 'https://foreign.example.test' }),
			},
		})
		await expect(
			foreign.ownership.request({
				params: f.params,
				body: { email: recipient, role: 'owner' },
			})
		).rejects.toMatchObject({ code: 'FORBIDDEN' })
	})
	it('rejects anonymous/direct writes and protected reads, and rejects privileged fields', async () => {
		const f = await fixture()
		for (const operation of [
			() =>
				f.anon.ownership.request({
					params: f.params,
					body: { email: 'person@example.test', role: 'owner' },
				}),
			() =>
				f.anon.ownership.verify({
					params: f.params,
					body: { challengeId: randomUUID(), code: '123456' },
				}),
			() => f.anon.ownership.get({ params: f.params }),
			() => f.anon.ownership.inbox({ query: {} }),
			() =>
				f.anon.ownership.upload({
					params: f.params,
					body: {
						kind: 'logo',
						filename: 'logo.png',
						contentType: 'image/png',
						size: 100,
					},
				}),
		]) {
			await expect(operation()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
		}
		await approved(f)
		await expect(
			f.alice.ownership.update({
				params: f.params,
				body: { revision: '1', status: 'removed' } as never,
			})
		).rejects.toMatchObject({ code: 'BAD_REQUEST' })
		await expect(
			f.alice.ownership.request({
				params: f.second,
				body: { email: 'person@example.test', role: 'admin' } as never,
			})
		).rejects.toMatchObject({ code: 'BAD_REQUEST' })
	})
	it('stores only a bound hash, requires email proof and an independent eligible approval', async () => {
		const f = await fixture()
		const { claim, challenge, mail } = await confirmed(f)
		expect(claim.codeHash).toBeNull()
		expect(
			await db
				.select()
				.from(projectMember)
				.where(eq(projectMember.projectId, f.params.id))
		).toEqual([])
		expect((await f.other.ownership.inbox({ query: {} })).claims).toEqual([])
		await expect(
			f.other.ownership.review({
				params: { id: claim.id },
				body: { decision: 'approve' },
			})
		).rejects.toMatchObject({ code: 'NOT_FOUND' })
		await expect(
			f.alice.ownership.get({ params: f.params })
		).rejects.toMatchObject({ code: 'NOT_FOUND' })
		await expect(
			f.alice.ownership.verify({
				params: f.params,
				body: { challengeId: challenge.challengeId, code: mail.code },
			})
		).rejects.toMatchObject({ code: 'BAD_REQUEST' })
		const inbox = await f.admin.ownership.inbox({ query: {} })
		expect(inbox.claims.some((item) => item.id === claim.id)).toBe(true)
		await f.admin.ownership.review({
			params: { id: claim.id },
			body: { decision: 'approve' },
		})
		expect(
			(await f.alice.ownership.state({ params: f.params })).membership
		).toBe('owner')
		expect(
			(
				await f.alice.project.getBySlug({
					params: { slug: f.projects[0]!.slug },
				})
			).verified
		).toBe(true)
		await expect(
			f.admin.ownership.review({
				params: { id: claim.id },
				body: { decision: 'approve' },
			})
		).rejects.toMatchObject({ code: 'NOT_FOUND' })
	})
	it('limits guesses, binds account/project/role, rotates resends and rejects expiry and replay', async () => {
		const f = await fixture()
		const challenge = await f.alice.ownership.request({
			params: f.params,
			body: { email: 'otp-binding@example.test', role: 'owner' },
		})
		const mail = sent.mock.calls.at(-1)![0]
		let [claim] = await db
			.select()
			.from(projectClaim)
			.where(eq(projectClaim.challengeId, challenge.challengeId))
		expect(claim!.codeHash).toBe(claimCodeHash(claim!, mail.code))
		expect(claim!.codeHash).not.toContain(mail.code)
		for (const [client, params] of [
			[f.bob, f.params],
			[f.alice, f.second],
		] as const) {
			await expect(
				client.ownership.verify({
					params,
					body: { challengeId: challenge.challengeId, code: mail.code },
				})
			).rejects.toMatchObject({ code: 'BAD_REQUEST' })
		}
		await expect(
			f.alice.ownership.request({
				params: f.params,
				body: { email: mail.email, role: 'owner' },
			})
		).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' })
		const wrong = mail.code === '999999' ? '000000' : '999999'
		for (let n = 0; n < 5; n++) {
			await expect(
				f.alice.ownership.verify({
					params: f.params,
					body: { challengeId: challenge.challengeId, code: wrong },
				})
			).rejects.toMatchObject({ code: 'BAD_REQUEST' })
		}
		;[claim] = await db
			.select()
			.from(projectClaim)
			.where(eq(projectClaim.id, claim!.id))
		expect(claim!.attempts).toBe(5)
		expect(claim!.codeHash).toBeNull()
		await db
			.update(projectClaim)
			.set({ requestedAt: new Date(Date.now() - 61000) })
			.where(eq(projectClaim.id, claim!.id))
		const next = await f.alice.ownership.request({
			params: f.params,
			body: { email: mail.email, role: 'maintainer' },
		})
		expect(next.challengeId).not.toBe(challenge.challengeId)
		await expect(
			f.alice.ownership.verify({
				params: f.params,
				body: { challengeId: challenge.challengeId, code: mail.code },
			})
		).rejects.toMatchObject({ code: 'BAD_REQUEST' })
		await db
			.update(projectClaim)
			.set({ codeExpiresAt: new Date(Date.now() - 1) })
			.where(eq(projectClaim.challengeId, next.challengeId))
		await expect(
			f.alice.ownership.verify({
				params: f.params,
				body: {
					challengeId: next.challengeId,
					code: sent.mock.calls.at(-1)![0].code,
				},
			})
		).rejects.toMatchObject({ code: 'BAD_REQUEST' })
	})
	it('lets either representative approve additional claims, prevents self-approval, and preserves admins', async () => {
		const f = await fixture()
		await approved(f, f.alice, 'maintainer')
		const extra = await confirmed(f, f.bob)
		await expect(
			f.admin.ownership.review({
				params: { id: extra.claim.id },
				body: { decision: 'approve' },
			})
		).rejects.toMatchObject({ code: 'NOT_FOUND' })
		await f.alice.ownership.review({
			params: { id: extra.claim.id },
			body: { decision: 'approve' },
		})
		const adminClaim = await confirmed(f, f.admin, 'maintainer')
		await f.bob.ownership.review({
			params: { id: adminClaim.claim.id },
			body: { decision: 'approve' },
		})
		expect(
			(await db.select().from(user).where(eq(user.id, f.users[0]!.id)))[0]!.role
		).toBe('admin')
		expect(
			(await f.alice.ownership.state({ params: f.params })).membership
		).toBe('maintainer')
		await expect(
			f.alice.admin.project.list({ query: {} })
		).rejects.toMatchObject({ code: 'FORBIDDEN' })
		await expect(
			f.alice.admin.upload.logo.request({
				body: { filename: 'x.png', contentType: 'image/png', size: 1 },
			})
		).rejects.toMatchObject({ code: 'FORBIDDEN' })
	})
	it('serializes competing bootstrap approvals and consumes an OTP exactly once under races', async () => {
		const f = await fixture()
		const one = await confirmed(f)
		const two = await confirmed(f, f.bob)
		const approvals = await Promise.allSettled(
			[one, two].map((item) =>
				f.admin.ownership.review({
					params: { id: item.claim.id },
					body: { decision: 'approve' },
				})
			)
		)
		expect(
			approvals.filter((item) => item.status === 'fulfilled')
		).toHaveLength(1)
		expect(
			await db
				.select()
				.from(projectMember)
				.where(eq(projectMember.projectId, f.params.id))
		).toHaveLength(1)
		const next = await f.other.ownership.request({
			params: f.second,
			body: { email: 'otp-race@example.test', role: 'owner' },
		})
		const body = {
			challengeId: next.challengeId,
			code: sent.mock.calls.at(-1)![0].code,
		}
		const attempts = await Promise.allSettled([
			f.other.ownership.verify({ params: f.second, body }),
			f.other.ownership.verify({ params: f.second, body }),
		])
		expect(attempts.filter((item) => item.status === 'fulfilled')).toHaveLength(
			1
		)
	})
	it('commits direct edits and category audit, denies cross-project writes, stale saves and privileged upload consumption', async () => {
		const f = await fixture()
		await approved(f)
		const data = await f.alice.ownership.get({ params: f.params })
		await f.alice.ownership.update({
			params: f.params,
			body: {
				revision: data.revision,
				name: 'Updated by owner',
				categorySlugs: [f.leaf.slug],
			},
		})
		expect(
			(await f.alice.project.getBySlug({ params: { slug: data.slug } })).name
		).toBe('Updated by owner')
		expect(
			(
				await db
					.select()
					.from(auditLog)
					.where(eq(auditLog.projectId, f.params.id))
			).some((item) => item.action === 'project_member_updated')
		).toBe(true)
		await expect(
			f.alice.ownership.update({
				params: f.params,
				body: { revision: data.revision, name: 'Stale' },
			})
		).rejects.toMatchObject({ code: 'CONFLICT' })
		for (const params of [f.params, f.second]) {
			await expect(
				f.bob.ownership.update({
					params,
					body: { revision: data.revision, name: 'Intrusion' },
				})
			).rejects.toMatchObject({ code: 'NOT_FOUND' })
		}
		await expect(
			f.alice.ownership.upload({
				params: f.second,
				body: {
					kind: 'logo',
					filename: 'x.png',
					contentType: 'image/png',
					size: 1,
				},
			})
		).rejects.toMatchObject({ code: 'NOT_FOUND' })
		const current = await f.alice.ownership.get({ params: f.params })
		const promotion = vi.spyOn(storage, 'promoteTempImageToProject')
		await expect(
			f.alice.ownership.update({
				params: f.params,
				body: { revision: current.revision, logo: 'tmp/logos/foreign-123.png' },
			})
		).rejects.toMatchObject({ code: 'BAD_REQUEST' })
		expect(promotion).not.toHaveBeenCalled()
		const upload = await f.alice.ownership.upload({
			params: f.params,
			body: {
				kind: 'logo',
				filename: 'x.png',
				contentType: 'image/png',
				size: 1,
			},
		})
		expect(
			(
				await db
					.select()
					.from(projectUpload)
					.where(eq(projectUpload.key, upload.key))
			)[0]!.userId
		).toBe(f.users[1]!.id)
		await expect(
			f.bob.ownership.removeUpload({
				params: f.params,
				body: { key: upload.key },
			})
		).rejects.toMatchObject({ code: 'NOT_FOUND' })
		const finalKey = `projects/${data.slug}/logo-${randomUUID()}.png`
		promotion.mockResolvedValue(finalKey)
		vi.spyOn(storage, 'deleteFinalKeysBestEffort').mockResolvedValue()
		await f.alice.ownership.update({
			params: f.params,
			body: { revision: current.revision, logo: upload.key },
		})
		expect((await f.alice.ownership.get({ params: f.params })).logo).toBe(
			finalKey
		)
		expect(
			await db
				.select()
				.from(projectUpload)
				.where(eq(projectUpload.key, upload.key))
		).toEqual([])
	})
	it('validates both upload grants before promoting either image', async () => {
		const f = await fixture()
		await approved(f)
		const current = await f.alice.ownership.get({ params: f.params })
		const keys = await mediaUploads(f)
		const promotion = vi
			.spyOn(storage, 'promoteTempImageToProject')
			.mockResolvedValue(`projects/${current.slug}/logo-${randomUUID()}.png`)
		vi.spyOn(storage, 'deleteFinalKeysBestEffort').mockResolvedValue()
		await expect(
			f.alice.ownership.update({
				params: f.params,
				body: {
					revision: current.revision,
					logo: keys.logo,
					screenshot: 'tmp/screenshots/foreign-123.png',
				},
			})
		).rejects.toMatchObject({ code: 'BAD_REQUEST' })
		expect(promotion).not.toHaveBeenCalled()
		expect(
			await db
				.select()
				.from(projectUpload)
				.where(eq(projectUpload.key, keys.logo))
		).toHaveLength(1)
		expect((await f.alice.ownership.get({ params: f.params })).logo).toBe(
			current.logo
		)
	})
	it('promotes both images without holding category or project locks and consumes grants only at commit', async () => {
		const f = await fixture()
		await approved(f)
		const current = await f.alice.ownership.get({ params: f.params })
		const keys = await mediaUploads(f)
		const finals = {
			logo: `projects/${current.slug}/logo-${randomUUID()}.png`,
			screenshot: `projects/${current.slug}/screenshot-${randomUUID()}.png`,
		}
		const promotion = vi
			.spyOn(storage, 'promoteTempImageToProject')
			.mockImplementation(async ({ kind }) => {
				await db.transaction(async (tx) => {
					await tx.execute(sql`SET LOCAL lock_timeout = '1s'`)
					await lockCategoryIntegrity(tx)
					await tx
						.select()
						.from(project)
						.where(eq(project.id, f.params.id))
						.for('update')
				})
				expect(
					await db
						.select()
						.from(projectUpload)
						.where(inArray(projectUpload.key, Object.values(keys)))
				).toHaveLength(2)
				return finals[kind]
			})
		const cleanup = vi
			.spyOn(storage, 'deleteFinalKeysBestEffort')
			.mockResolvedValue()
		await f.alice.ownership.update({
			params: f.params,
			body: { revision: current.revision, ...keys },
		})
		expect(promotion).toHaveBeenCalledTimes(2)
		expect(await f.alice.ownership.get({ params: f.params })).toMatchObject(
			finals
		)
		expect(
			await db
				.select()
				.from(projectUpload)
				.where(inArray(projectUpload.key, Object.values(keys)))
		).toEqual([])
		expect(cleanup).toHaveBeenCalledWith([current.logo])
	})
	it.each(['revision', 'membership', 'upload', 'visibility'] as const)(
		'rechecks %s after S3 work and cleans up both promoted images on failure',
		async (change) => {
			const f = await fixture()
			await approved(f)
			const current = await f.alice.ownership.get({ params: f.params })
			const keys = await mediaUploads(f)
			const finals = {
				logo: `projects/${current.slug}/logo-${randomUUID()}.png`,
				screenshot: `projects/${current.slug}/screenshot-${randomUUID()}.png`,
			}
			vi.spyOn(storage, 'promoteTempImageToProject').mockImplementation(
				async ({ kind }) => {
					if (kind === 'logo') {
						await db.transaction(async (tx) => {
							await tx.execute(sql`SET LOCAL lock_timeout = '1s'`)
							await lockCategoryIntegrity(tx)
							await tx
								.select()
								.from(project)
								.where(eq(project.id, f.params.id))
								.for('update')
							switch (change) {
								case 'revision':
									await tx
										.update(project)
										.set({ name: 'Concurrent edit' })
										.where(eq(project.id, f.params.id))
									break
								case 'membership':
									await tx
										.delete(projectMember)
										.where(eq(projectMember.projectId, f.params.id))
									break
								case 'upload':
									await tx
										.delete(projectUpload)
										.where(eq(projectUpload.key, keys.screenshot))
									break
								case 'visibility':
									await tx
										.update(project)
										.set({ status: 'rejected' })
										.where(eq(project.id, f.params.id))
									break
							}
						})
					}
					return finals[kind]
				}
			)
			const cleanup = vi
				.spyOn(storage, 'deleteFinalKeysBestEffort')
				.mockResolvedValue()
			await expect(
				f.alice.ownership.update({
					params: f.params,
					body: { revision: current.revision, ...keys },
				})
			).rejects.toMatchObject({ code: 'UPLOAD_CONSUMED' })
			expect(cleanup).toHaveBeenCalledExactlyOnceWith(Object.values(finals))
			const [saved] = await db
				.select()
				.from(project)
				.where(eq(project.id, f.params.id))
			expect(saved).toMatchObject({
				logo: current.logo,
				screenshot: current.screenshot,
			})
			expect(
				await db
					.select()
					.from(projectUpload)
					.where(eq(projectUpload.key, keys.logo))
			).toHaveLength(1)
			expect(
				await db
					.select()
					.from(auditLog)
					.where(
						and(
							eq(auditLog.projectId, f.params.id),
							eq(auditLog.action, 'project_member_updated')
						)
					)
			).toEqual([])
		}
	)
	it('cleans up a promoted logo when the second storage promotion fails', async () => {
		const f = await fixture()
		await approved(f)
		const current = await f.alice.ownership.get({ params: f.params })
		const keys = await mediaUploads(f)
		const finalLogo = `projects/${current.slug}/logo-${randomUUID()}.png`
		vi.spyOn(storage, 'promoteTempImageToProject')
			.mockResolvedValueOnce(finalLogo)
			.mockRejectedValueOnce(new storage.TempUploadMissingError())
		const cleanup = vi
			.spyOn(storage, 'deleteFinalKeysBestEffort')
			.mockResolvedValue()
		await expect(
			f.alice.ownership.update({
				params: f.params,
				body: { revision: current.revision, ...keys },
			})
		).rejects.toMatchObject({ code: 'UPLOAD_CONSUMED' })
		expect(cleanup).toHaveBeenCalledExactlyOnceWith([finalLogo])
		expect(await f.alice.ownership.get({ params: f.params })).toMatchObject({
			logo: current.logo,
			screenshot: current.screenshot,
		})
	})
	it('keeps public projections private, ranks verified listings first with stable ties, and hides unpublished/deleted projects', async () => {
		const f = await fixture()
		await approved(f)
		const date = new Date('2026-10-01T00:00:00Z')
		await db
			.update(project)
			.set({ createdAt: date })
			.where(
				inArray(
					project.id,
					f.projects.map((item) => item.id)
				)
			)
		const recommended = await f.anon.project.search({
			query: { q: f.token, sort: 'recommended', limit: 1 },
		})
		expect(recommended.projects[0]!.id).toBe(f.params.id)
		expect(recommended.pagination.totalItems).toBe(2)
		const latest = await f.anon.project.search({
			query: { q: f.token, sort: 'newest' },
		})
		expect(latest.projects.map((item) => item.id)).toEqual(
			f.projects
				.map((item) => item.id)
				.toSorted()
				.toReversed()
		)
		const secondClaim = await confirmed(f, f.bob, 'maintainer', f.second)
		await f.admin.ownership.review({
			params: { id: secondClaim.claim.id },
			body: { decision: 'approve' },
		})
		const tied = await f.anon.project.search({
			query: { q: f.token, sort: 'recommended' },
		})
		expect(tied.projects.map((item) => item.id)).toEqual(
			f.projects
				.map((item) => item.id)
				.toSorted()
				.toReversed()
		)
		const row = (await f.anon.project.getBySlug({
			params: { slug: f.projects[0]!.slug },
		})) as unknown as Record<string, unknown>
		for (const key of [
			'email',
			'submitterId',
			'codeHash',
			'reviewerId',
			'members',
		]) {
			expect(row).not.toHaveProperty(key)
		}
		await db
			.update(project)
			.set({ status: 'removed' })
			.where(eq(project.id, f.params.id))
		await expect(
			f.alice.ownership.get({ params: f.params })
		).rejects.toMatchObject({ code: 'NOT_FOUND' })
		await expect(
			f.alice.ownership.upload({
				params: f.params,
				body: {
					kind: 'logo',
					filename: 'x.png',
					contentType: 'image/png',
					size: 1,
				},
			})
		).rejects.toMatchObject({ code: 'NOT_FOUND' })
		expect((await f.alice.ownership.list({ query: {} })).projects).toEqual([])
		expect(
			(
				await f.anon.project.search({
					query: { q: f.token, sort: 'recommended' },
				})
			).pagination.totalItems
		).toBe(1)
		await db.delete(project).where(eq(project.id, f.params.id))
		expect(
			await db
				.select()
				.from(projectClaim)
				.where(eq(projectClaim.projectId, f.params.id))
		).toEqual([])
		expect(
			await db
				.select()
				.from(projectMember)
				.where(eq(projectMember.projectId, f.params.id))
		).toEqual([])
	})
	it('requires a linked GitHub identity and never emails a disconnected claimant', async () => {
		const f = await fixture()
		await db.delete(account).where(eq(account.userId, f.users[1]!.id))
		expect(await f.alice.ownership.github({ params: f.params })).toMatchObject({
			status: 'disconnected',
			githubUserId: null,
		})
		await expect(
			f.alice.ownership.request({
				params: f.params,
				body: { email: 'claim@example.test', role: 'owner' },
			})
		).rejects.toMatchObject({ code: 'FORBIDDEN' })
		expect(sent).not.toHaveBeenCalled()
		await expect(
			f.anon.ownership.github({ params: f.params })
		).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
	})
	it.each(['read', 'triage', 'none'])(
		'blocks confirmed %s access rather than treating public visibility as project authority',
		async (permission) => {
			const f = await fixture()
			githubResponses((url) =>
				url.pathname === '/user'
					? Response.json({ id: 123, login: 'reader' })
					: Response.json({
							id: 456,
							private: false,
							permissions: {
								admin: false,
								push: false,
								pull: permission !== 'none',
								triage: permission === 'triage',
							},
						})
			)
			expect(
				await f.alice.ownership.github({ params: f.params })
			).toMatchObject({ status: 'denied', permission })
			await expect(
				f.alice.ownership.request({
					params: f.params,
					body: { email: 'reader@example.test', role: 'maintainer' },
				})
			).rejects.toMatchObject({ code: 'FORBIDDEN' })
			expect(sent).not.toHaveBeenCalled()
		}
	)
	it('binds GitHub evidence to the OTP and rechecks lost permissions before approval even with manual notes', async () => {
		const f = await fixture()
		const pending = await confirmed(f)
		expect(pending.claim.githubEvidence).toMatchObject({
			status: 'verified',
			permission: 'maintain',
			githubUserId: '123',
			repositoryId: '456',
		})
		const [call] = vi.mocked(fetch).mock.calls
		expect(new Headers(call![1]?.headers).get('authorization')).toBe(
			'Bearer synthetic-claim-github-token'
		)
		const body = {
			params: { id: pending.claim.id },
			body: {
				decision: 'approve' as const,
				manualEvidence:
					'Independent confirmation cannot override a confirmed loss of access.',
			},
		}
		githubResponses((url) =>
			url.pathname === '/user'
				? Response.json({ id: 123, login: 'reader' })
				: Response.json({
						id: 456,
						private: false,
						permissions: { admin: false, push: false, pull: true },
					})
		)
		await expect(f.admin.ownership.review(body)).rejects.toMatchObject({
			code: 'FORBIDDEN',
		})
		expect(
			await db
				.select()
				.from(projectMember)
				.where(eq(projectMember.projectId, f.params.id))
		).toEqual([])
		const changedProof = {
			...pending.claim,
			githubEvidence: { ...pending.claim.githubEvidence!, githubUserId: '999' },
		}
		expect(claimCodeHash(changedProof, pending.mail.code)).not.toBe(
			claimCodeHash(pending.claim, pending.mail.code)
		)
	})
	it.each(['write', 'unavailable'])(
		'requires recorded independent evidence for %s and audits the approved proof privately',
		async (kind) => {
			const f = await fixture()
			githubResponses((url) =>
				url.pathname === '/user'
					? Response.json({ id: 123, login: 'representative' })
					: kind === 'unavailable'
						? Response.json(
								{ message: 'Sensitive upstream payload' },
								{ status: 403 }
							)
						: Response.json({
								id: 456,
								private: false,
								permissions: { admin: false, push: true, pull: true },
							})
			)
			const pending = await confirmed(f)
			await expect(
				f.admin.ownership.review({
					params: { id: pending.claim.id },
					body: { decision: 'approve' },
				})
			).rejects.toMatchObject({ code: 'BAD_REQUEST' })
			const manualEvidence =
				'Confirmed with the established project representative through a separate existing channel.'
			await f.admin.ownership.review({
				params: { id: pending.claim.id },
				body: { decision: 'approve', manualEvidence },
			})
			const events = await db
				.select()
				.from(auditLog)
				.where(eq(auditLog.projectId, f.params.id))
			expect(
				events.find((event) => event.action === 'project_claim_approved')
					?.metadata
			).toMatchObject({
				manualEvidence,
				github: { status: kind === 'write' ? 'limited' : 'unavailable' },
			})
			const listing = await f.anon.project.getBySlug({
				params: { slug: f.projects[0]!.slug },
			})
			expect(JSON.stringify(listing)).not.toMatch(
				/manualEvidence|githubEvidence|Sensitive upstream|synthetic-claim-github-token/
			)
		}
	)
	it.each(['identity', 'repository'])(
		'rejects a mismatched %s instead of trusting the supplied username or project URL',
		async (mismatch) => {
			const f = await fixture()
			await db
				.update(githubRepository)
				.set({ githubRepositoryId: 456 })
				.where(eq(githubRepository.projectId, f.params.id))
			githubResponses((url) =>
				url.pathname === '/user'
					? Response.json({
							id: mismatch === 'identity' ? 999 : 123,
							login: 'somebody',
						})
					: Response.json({
							id: 999,
							private: false,
							permissions: { admin: true, push: true, pull: true },
						})
			)
			expect(
				await f.alice.ownership.github({ params: f.params })
			).toMatchObject({
				status: 'denied',
				reason:
					mismatch === 'identity' ? 'identity_mismatch' : 'repository_changed',
			})
			await expect(
				f.alice.ownership.request({
					params: f.params,
					body: { email: 'mismatch@example.test', role: 'owner' },
				})
			).rejects.toMatchObject({ code: 'FORBIDDEN' })
		}
	)
	it.each(['unlink', 'project', 'repository-id'])(
		'rejects a concurrent %s change before issuing a bound challenge',
		async (change) => {
			const f = await fixture()
			vi.mocked(fetch).mockImplementation(async (input) => {
				if (
					new URL(input instanceof Request ? input.url : input).pathname ===
					'/user'
				) {
					return Response.json({ id: 123, login: 'representative' })
				}
				if (change === 'unlink') {
					await db.delete(account).where(eq(account.userId, f.users[1]!.id))
				} else if (change === 'repository-id') {
					await db
						.update(githubRepository)
						.set({ githubRepositoryId: 999 })
						.where(eq(githubRepository.projectId, f.params.id))
				} else {
					await db
						.update(project)
						.set({ repositoryUrl: 'https://github.com/new/project' })
						.where(eq(project.id, f.params.id))
				}
				return Response.json({
					id: 456,
					private: false,
					permissions: { admin: true, push: true, pull: true },
				})
			})
			await expect(
				f.alice.ownership.request({
					params: f.params,
					body: { email: 'changed@example.test', role: 'owner' },
				})
			).rejects.toMatchObject({ code: 'CONFLICT' })
			expect(sent).not.toHaveBeenCalled()
		}
	)
	it('does not turn omitted permission metadata into successful verification', async () => {
		const f = await fixture()
		githubResponses((url) =>
			url.pathname === '/user'
				? Response.json({ id: 123, login: 'representative' })
				: Response.json({ id: 456, private: false })
		)
		expect(await f.alice.ownership.github({ params: f.params })).toMatchObject({
			status: 'unavailable',
			permission: 'unknown',
			reason: 'github_unavailable',
		})
	})
	it.each([401, 403, 404, 429, 500])(
		'keeps GitHub %s failures unverified and never leaks upstream errors',
		async (status) => {
			const f = await fixture()
			vi.mocked(fetch).mockResolvedValue(
				Response.json({ message: 'Private provider response' }, { status })
			)
			const proof = await f.alice.ownership.github({ params: f.params })
			expect(proof).toMatchObject({
				status: 'unavailable',
				permission: 'unknown',
			})
			expect(JSON.stringify(proof)).not.toContain('Private provider response')
		}
	)
	it('fails closed on email delivery errors and enforces an atomic persistent quota', async () => {
		const f = await fixture()
		sent.mockRejectedValueOnce(new Error('provider secret details'))
		await expect(
			f.alice.ownership.request({
				params: f.params,
				body: { email: 'failure@example.test', role: 'owner' },
			})
		).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' })
		const state = await f.alice.ownership.state({ params: f.params })
		expect(state.claim?.challenge).toBeNull()
		const subject = `race:${randomUUID()}`
		const results = await Promise.allSettled(
			Array.from({ length: 12 }, () => enforceClaimQuota(db, subject, 5))
		)
		expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(
			5
		)
		await expect(enforceClaimQuota(db, subject, 5)).rejects.toMatchObject({
			code: 'TOO_MANY_REQUESTS',
		})
	})
})
