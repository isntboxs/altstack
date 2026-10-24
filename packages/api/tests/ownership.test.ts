import { createRouterClient } from '@orpc/server'
import { eq, inArray } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import type { ORPCContext } from '@altstack/api/context'
import { claimCodeHash, enforceClaimQuota } from '@altstack/api/ownership-otp'
import { routers } from '@altstack/api/routers'
import * as storage from '@altstack/api/storage'

import { db } from '@altstack/db'
import {
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
