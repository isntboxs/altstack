import { createRouterClient } from '@orpc/server'
import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from 'vite-plus/test'

import { adAccessToken, validAdAccess } from '@altstack/api/ad-access'
import type * as AdNotifications from '@altstack/api/ad-notifications'
import {
	runAdNotificationBatch,
	queueAdNotification,
} from '@altstack/api/ad-notifications'
import { reviewAdOrder, confirmAdPayment } from '@altstack/api/ad-orders'
import type { ORPCContext } from '@altstack/api/context'
import {
	adBillingRouter,
	adminAdBillingRouter,
} from '@altstack/api/routers/ad-billing'
import { adsRouter, adminAdsRouter } from '@altstack/api/routers/ads'
import type * as Upload from '@altstack/api/routers/upload'
import type * as Storage from '@altstack/api/storage'

import {
	adCampaign,
	adOrder,
	adPayment,
	adUpload,
	adNotification,
	rateLimit,
	user,
} from '@altstack/db/schemas'

import { AD_PLANS, nextAdMonth } from '@altstack/shared/schemas/ad-billing'
import type { AdPlan } from '@altstack/shared/schemas/ad-billing'

import { connectTestPostgres } from '../../db/tests/helpers/postgres'

const mock = vi.hoisted(() => {
	return {
		promote: vi.fn(),
		cleanup: vi.fn(),
		remove: vi.fn(),
		change: vi.fn(),
		provider: vi.fn(),
		configured: true,
	}
})
type EmailPayload = NonNullable<typeof adNotification.$inferSelect.payload>
const config = {
	appUrl: 'https://altstack.example',
	from: 'AltStack <ads@example.test>',
	contactEmail: 'team@example.test',
}
vi.mock('@altstack/api/ad-notifications', async (original) => {
	const actual = await original<typeof AdNotifications>()
	return {
		...actual,
		adEmailConfig: () =>
			mock.configured
				? {
						appUrl: 'https://altstack.example',
						from: 'AltStack <ads@example.test>',
						contactEmail: 'team@example.test',
					}
				: null,
	}
})
vi.mock('resend', () => {
	return {
		Resend: class {
			emails = { send: mock.provider }
		},
	}
})
vi.mock('@altstack/api/storage', async (original) => {
	return {
		...(await original<typeof Storage>()),
		promoteTempImageToAd: mock.promote,
		deleteFinalKeysBestEffort: mock.cleanup,
	}
})
vi.mock('@altstack/api/routers/upload', async (original) => {
	return {
		...(await original<typeof Upload>()),
		requestImageUpload: vi.fn((_input: unknown, kind: { prefix: string }) =>
			Promise.resolve({
				key: `${kind.prefix}${randomUUID()}-1.png`,
				presignedUrl: 'https://uploads.example.test/signed',
			})
		),
		removeImageUpload: mock.remove,
		changeImageUpload: mock.change,
	}
})

let postgres: Awaited<ReturnType<typeof connectTestPostgres>>,
	scope: Awaited<ReturnType<typeof postgres.createSchema>>
let adminId: string
function ctx(role?: 'admin' | 'user'): ORPCContext {
	return {
		db: scope.db,
		auth: role
			? ({ user: { id: adminId, role } } as ORPCContext['auth'])
			: null,
		requestHeaders: new Headers({ 'x-forwarded-for': '192.0.2.10' }),
	}
}
const guest = () => createRouterClient(adBillingRouter, { context: ctx() })
const admin = () =>
	createRouterClient(adminAdBillingRouter, { context: ctx('admin') })
const inventory = () => createRouterClient(adsRouter, { context: ctx() })
const access = (record: typeof adOrder.$inferSelect) => {
	return {
		id: record.id,
		token: adAccessToken(record),
	}
}
async function stored(id: string) {
	const [row] = await scope.db.select().from(adOrder).where(eq(adOrder.id, id))
	return row!
}
async function order(plan: AdPlan = 'plus') {
	const email = `advertiser-${randomUUID()}@example.test`
	expect(
		await guest().create({ body: { plan, email, termsAccepted: true } })
	).toEqual({ success: true })
	const [row] = await scope.db
		.select()
		.from(adOrder)
		.where(eq(adOrder.email, email))
	return row!
}
async function pay(row: typeof adOrder.$inferSelect) {
	await admin().confirmPayment({
		body: {
			id: row.id,
			expectedVersion: row.version,
			kind: 'initial',
			reference: `bank:${randomUUID()}`,
		},
	})
	return stored(row.id)
}
async function submit(row: typeof adOrder.$inferSelect) {
	const logo = `tmp/logos/${randomUUID()}-1.png`,
		banner = `tmp/screenshots/${randomUUID()}-1.png`
	await scope.db.insert(adUpload).values([
		{ key: logo, orderId: row.id, kind: 'logo' },
		{ key: banner, orderId: row.id, kind: 'banner' },
	])
	return guest().submit({
		body: {
			...access(row),
			expectedVersion: row.version,
			material: {
				name: 'Synthetic advertiser',
				description: 'An integration fixture.',
				websiteUrl: 'https://advertiser.example.test',
				logo,
				banner: row.plan === 'core' ? logo : banner,
			},
		},
	})
}
const approval = (id: string, version: number) => {
	return {
		id,
		expectedVersion: version,
		decision: 'approve' as const,
		reason: '',
		ctaText: 'Visit fixture',
		buttonColor: '#008080',
	}
}
async function live(plan: AdPlan = 'plus') {
	const row = await pay(await order(plan)),
		submitted = await submit(row)
	await admin().review({ body: approval(row.id, submitted.version) })
	return stored(row.id)
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
	const [adminRecord] = await scope.db
		.insert(user)
		.values({
			name: 'Synthetic admin',
			email: 'admin@example.test',
			role: 'admin',
		})
		.returning()
	adminId = adminRecord!.id
}, 60000)
beforeEach(async () => {
	await scope.db.delete(adPayment)
	await scope.db.delete(adOrder)
	await scope.db.delete(adCampaign)
	await scope.db.delete(rateLimit)
	mock.configured = true
	mock.promote
		.mockReset()
		.mockImplementation((_key: string, id: string, kind: string) =>
			Promise.resolve(`ads/${id}/${kind}-${randomUUID()}.png`)
		)
	mock.cleanup.mockReset().mockResolvedValue(undefined)
	mock.remove.mockReset().mockResolvedValue({ success: true })
	mock.change.mockReset().mockResolvedValue({ success: true })
	mock.provider
		.mockReset()
		.mockResolvedValue({ data: { id: 'synthetic' }, error: null })
})
afterAll(async () => {
	await scope.close()
	await postgres.close()
}, 60000)

describe('guest advertising orders and manual payment', () => {
	it.each(['core', 'plus', 'priority'] as const)(
		'fixes %s price on the server and never returns bearer credentials to an unverified email submitter',
		async (plan) => {
			const row = await order(plan)
			expect(row.amount).toBe(AD_PLANS[plan].amount)
			expect(row.paidAt).toBeNull()
			expect(row.status).toBe('pending_payment')
			expect((await inventory().list({})).campaigns).toEqual([])
			expect(await scope.db.select().from(adNotification)).toHaveLength(2)
			const view = await guest().get({ body: access(row) })
			expect(view).not.toHaveProperty('accessNonce')
			expect(view).not.toHaveProperty('payments')
			await expect(
				guest().upload.logo.request({
					body: {
						...access(row),
						filename: 'logo.png',
						contentType: 'image/png',
						size: 100,
					},
				})
			).rejects.toMatchObject({ code: 'FORBIDDEN' })
		}
	)
	it('coalesces concurrent pending orders, while allowing fresh access only by email', async () => {
		const email = 'same@example.test',
			body = { email, plan: 'core' as const, termsAccepted: true as const }
		expect(
			await Promise.all([guest().create({ body }), guest().create({ body })])
		).toEqual([{ success: true }, { success: true }])
		expect(await scope.db.select().from(adOrder)).toHaveLength(1)
		expect(await guest().requestAccess({ body: { email } })).toEqual(
			await guest().requestAccess({ body: { email: 'missing@example.test' } })
		)
		const notices = await scope.db.select().from(adNotification)
		expect(notices.filter((row) => row.kind === 'access')).toHaveLength(1)
	})
	it('fails closed without email configuration and limits repeated email submissions', async () => {
		mock.configured = false
		await expect(order()).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' })
		mock.configured = true
		const body = {
			email: 'limited@example.test',
			plan: 'core' as const,
			termsAccepted: true as const,
		}
		for (let i = 0; i < 3; i++) await guest().create({ body })
		await expect(guest().create({ body })).rejects.toMatchObject({
			code: 'TOO_MANY_REQUESTS',
		})
	})
	it('binds signed access to the order, nonce and expiry', async () => {
		const row = await order(),
			other = await order(),
			now = Date.now(),
			token = adAccessToken(row, now)
		expect(validAdAccess(row, token, now)).toBe(true)
		expect(validAdAccess(other, token, now)).toBe(false)
		expect(validAdAccess(row, token, now + 86400000)).toBe(false)
		expect(validAdAccess(row, token + '.extra', now)).toBe(false)
		expect(
			validAdAccess({ ...row, accessNonce: randomUUID() }, token, now)
		).toBe(false)
		await expect(
			guest().get({ body: { id: other.id, token } })
		).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
	})
	it.each([undefined, 'user'] as const)(
		'requires admin for payment, review and inventory controls (%s)',
		async (role) => {
			const row = await order(),
				client = createRouterClient(adminAdBillingRouter, {
					context: ctx(role),
				})
			const code = role ? 'FORBIDDEN' : 'UNAUTHORIZED'
			await expect(client.list({})).rejects.toMatchObject({ code })
			await expect(
				client.confirmPayment({
					body: {
						id: row.id,
						expectedVersion: row.version,
						kind: 'initial',
						reference: 'fixture',
					},
				})
			).rejects.toMatchObject({ code })
			await expect(
				client.review({ body: approval(row.id, row.version) })
			).rejects.toMatchObject({ code })
			await expect(
				client.setStatus({
					body: {
						id: row.id,
						expectedVersion: row.version,
						status: 'inactive',
					},
				})
			).rejects.toMatchObject({ code })
		}
	)
	it('records only one payment under concurrent confirmations and prevents reusing a reference', async () => {
		const row = await order(),
			input = {
				id: row.id,
				expectedVersion: row.version,
				kind: 'initial' as const,
				reference: 'bank:transaction-1',
			}
		const results = await Promise.allSettled([
			admin().confirmPayment({ body: input }),
			admin().confirmPayment({ body: input }),
		])
		expect(
			results.filter((result) => result.status === 'fulfilled')
		).toHaveLength(1)
		expect(await scope.db.select().from(adPayment)).toHaveLength(1)
		expect((await stored(row.id)).startsAt).toBeNull()
		const other = await order()
		await expect(
			admin().confirmPayment({
				body: { ...input, id: other.id, reference: 'BANK:TRANSACTION-1' },
			})
		).rejects.toMatchObject({ code: 'CONFLICT' })
		expect((await stored(other.id)).paidAt).toBeNull()
	})
	it('checks guest upload ownership and keeps promoted artwork outside temporary deletion routes', async () => {
		const row = await pay(await order()),
			other = await pay(await order())
		const upload = await guest().upload.logo.request({
			body: {
				...access(row),
				filename: 'logo.png',
				contentType: 'image/png',
				size: 100,
			},
		})
		await expect(
			guest().upload.logo.remove({
				body: { ...access(other), key: upload.key },
			})
		).rejects.toMatchObject({ code: 'NOT_FOUND' })
		expect(mock.remove).not.toHaveBeenCalled()
		await expect(
			guest().submit({
				body: {
					...access(other),
					expectedVersion: other.version,
					material: {
						name: 'Fixture',
						description: 'Fixture',
						websiteUrl: 'https://example.test',
						logo: upload.key,
						banner: upload.key,
					},
				},
			})
		).rejects.toMatchObject({ code: 'BAD_REQUEST' })
		expect(mock.promote).not.toHaveBeenCalled()
		await guest().upload.logo.remove({
			body: { ...access(row), key: upload.key },
		})
		expect(mock.remove).toHaveBeenCalledWith(upload.key, expect.anything())
	})
	it.each(['core', 'plus', 'priority'] as const)(
		'publishes %s only after payment and approval, with a full month from approval',
		async (plan) => {
			const row = await pay(await order(plan)),
				submitted = await submit(row)
			expect((await inventory().list({})).campaigns).toEqual([])
			const now = new Date('2028-01-31T12:30:00Z')
			const saved = await reviewAdOrder(
				scope.db,
				approval(row.id, submitted.version),
				now
			)
			expect(saved.startsAt).toEqual(now)
			expect(saved.paidThrough).toEqual(new Date('2028-02-29T12:30:00Z'))
			const [campaign] = await scope.db.select().from(adCampaign)
			expect(campaign).toMatchObject({
				tier: AD_PLANS[plan].tier,
				status: 'active',
				startsAt: now,
				endsAt: saved.paidThrough,
				ctaText: 'Visit fixture',
				buttonColor: '#008080',
			})
			expect(plan !== 'core' || campaign!.logo === campaign!.banner).toBe(true)
			await expect(
				createRouterClient(adminAdsRouter, { context: ctx('admin') }).delete({
					params: { id: campaign!.id },
					body: { expectedVersion: campaign!.version },
				})
			).rejects.toMatchObject({ code: 'CONFLICT' })
		}
	)
	it('keeps live artwork and dates during revisions; a decline restores approved materials', async () => {
		const row = await live(),
			[before] = await scope.db.select().from(adCampaign)
		const edited = await guest().submit({
			body: {
				...access(row),
				expectedVersion: row.version,
				material: { ...row.material!, name: 'Proposed replacement' },
			},
		})
		expect((await inventory().list({})).campaigns[0]!.name).toBe(before!.name)
		await expect(
			admin().review({
				body: { ...approval(row.id, edited.version), decision: 'reject' },
			})
		).rejects.toMatchObject({ code: 'BAD_REQUEST' })
		const declined = await admin().review({
			body: {
				...approval(row.id, edited.version),
				decision: 'reject',
				reason: 'Keep the existing brand name.',
			},
		})
		expect(declined.status).toBe('approved')
		expect(declined.material!.name).toBe(before!.name)
		expect(declined.paidThrough).toEqual(row.paidThrough)
		const [after] = await scope.db.select().from(adCampaign)
		expect(after).toEqual(before)
	})
	it('requests renewal without extending dates, extends once after verified payment, and respects immediate deactivation', async () => {
		const row = await live(),
			requested = await guest().requestRenewal({ body: access(row) })
		expect(requested.paidThrough).toEqual(row.paidThrough)
		expect((await guest().requestRenewal({ body: access(row) })).version).toBe(
			requested.version
		)
		const now = new Date(row.paidThrough!.getTime() - 1000)
		const renewed = await confirmAdPayment(
			scope.db,
			{
				id: row.id,
				expectedVersion: requested.version,
				kind: 'renewal',
				reference: 'bank:renewal-1',
			},
			adminId,
			now
		)
		expect(renewed.paidThrough).toEqual(nextAdMonth(row.paidThrough!))
		expect(renewed.renewalRequestedAt).toBeNull()
		await expect(
			confirmAdPayment(
				scope.db,
				{
					id: row.id,
					expectedVersion: requested.version,
					kind: 'renewal',
					reference: 'bank:renewal-1',
				},
				adminId,
				now
			)
		).rejects.toMatchObject({ code: 'CONFLICT' })
		await admin().setStatus({
			body: {
				id: row.id,
				expectedVersion: renewed.version,
				status: 'inactive',
			},
		})
		expect((await inventory().list({})).campaigns).toEqual([])
		expect((await stored(row.id)).paidThrough).toEqual(renewed.paidThrough)
	})
	it('starts a lapsed renewal at confirmation and never extends time for material approval', async () => {
		const row = await live(),
			requested = await guest().requestRenewal({ body: access(row) }),
			now = new Date(row.paidThrough!.getTime() + 3 * 86400000)
		const renewed = await confirmAdPayment(
			scope.db,
			{
				id: row.id,
				expectedVersion: requested.version,
				kind: 'renewal',
				reference: 'bank:lapsed',
			},
			adminId,
			now
		)
		expect(renewed.paidThrough).toEqual(nextAdMonth(now))
		const submitted = await guest().submit({
			body: {
				...access(row),
				expectedVersion: renewed.version,
				material: row.material!,
			},
		})
		const approved = await reviewAdOrder(
			scope.db,
			approval(row.id, submitted.version),
			new Date(now.getTime() + 86400000)
		)
		expect(approved.paidThrough).toEqual(renewed.paidThrough)
	})
})

describe('durable order email delivery', () => {
	it('leases messages across workers and treats SDK error results as delivery failures', async () => {
		await order()
		const send = vi
			.fn<(payload: EmailPayload, key: string) => Promise<void>>()
			.mockResolvedValue(undefined)
		const now = () => new Date(Date.now() + 60000)
		const results = await Promise.all([
			runAdNotificationBatch(scope.db, { config, send, now }),
			runAdNotificationBatch(scope.db, { config, send, now }),
		])
		expect(results.reduce((sum, result) => sum + result.sent, 0)).toBe(2)
		expect(new Set(send.mock.calls.map((call) => call[1])).size).toBe(2)
		const record = (await scope.db.select().from(adOrder))[0]!
		await queueAdNotification(scope.db, record.id, 'access', 'sdk-failure')
		mock.provider.mockResolvedValue({
			data: null,
			error: { message: 'Synthetic provider rejection' },
		})
		expect(
			await runAdNotificationBatch(scope.db, { config, now })
		).toMatchObject({ sent: 0, failed: 1 })
		const [pending] = await scope.db
			.select()
			.from(adNotification)
			.where(eq(adNotification.eventKey, 'sdk-failure'))
		expect(pending!.status).toBe('pending')
		expect(pending!.payload).not.toBeNull()
	})
	it('does not send uncommitted or rolled-back order notifications', async () => {
		const record = await order()
		await scope.db.delete(adNotification)
		const send = vi
			.fn<(payload: EmailPayload, key: string) => Promise<void>>()
			.mockResolvedValue(undefined)
		await expect(
			scope.db.transaction(async (tx) => {
				await queueAdNotification(tx, record.id, 'paid', 'rollback-fixture')
				expect(
					await runAdNotificationBatch(scope.db, {
						config,
						send,
						now: () => new Date(Date.now() + 60000),
					})
				).toMatchObject({ sent: 0 })
				throw new Error('Synthetic rollback')
			})
		).rejects.toThrow('Synthetic rollback')
		expect(send).not.toHaveBeenCalled()
		expect(await scope.db.select().from(adNotification)).toEqual([])
	})
	it('delivers private links only to the advertiser, and an admin URL to staff', async () => {
		const row = await order(),
			send = vi
				.fn<(payload: EmailPayload, key: string) => Promise<void>>()
				.mockResolvedValue(undefined),
			now = () => new Date(Date.now() + 60000)
		expect(
			await runAdNotificationBatch(scope.db, { config, send, now })
		).toMatchObject({ sent: 2 })
		const userEmail = send.mock.calls.find(
			(call) => call[0].to === row.email
		)![0]
		const staffEmail = send.mock.calls.find(
			(call) => call[0].to === config.contactEmail
		)![0]
		expect(userEmail.html).toContain('/advertise/manage#id=')
		expect(userEmail.replyTo).toBe(config.contactEmail)
		expect(staffEmail.html).toContain('/admin/ads')
		expect(staffEmail.html).not.toContain('token=')
		expect(
			await runAdNotificationBatch(scope.db, { config, send, now })
		).toMatchObject({ sent: 0 })
		expect(mock.provider).not.toHaveBeenCalled()
	})
	it('freezes retry payload and provider key, escapes feedback, and stops after the retry window', async () => {
		const row = await order()
		await scope.db.delete(adNotification)
		await queueAdNotification(
			scope.db,
			row.id,
			'revision',
			'fixture-revision',
			'<script>alert("bad")</script>'
		)
		let time = new Date(Date.now() + 60000)
		const send = vi
			.fn<(payload: EmailPayload, key: string) => Promise<void>>()
			.mockRejectedValueOnce(new Error('Provider failed'))
			.mockResolvedValue(undefined)
		const batch = () =>
			runAdNotificationBatch(scope.db, { config, send, now: () => time })
		expect(await batch()).toMatchObject({ sent: 0, failed: 1 })
		const first = send.mock.calls[0]!
		expect(first[0].html).not.toContain('<script>')
		expect(first[0].html).toContain('&lt;script&gt;')
		time = new Date(time.getTime() + 10 * 60000)
		expect(await batch()).toMatchObject({ sent: 1 })
		expect(send.mock.calls[1]).toEqual(first)
		await queueAdNotification(scope.db, row.id, 'access', 'expired-notice')
		time = new Date(Date.now() + 24 * 60 * 60000)
		expect(await batch()).toMatchObject({ sent: 0, failed: 1 })
		expect(send).toHaveBeenCalledTimes(2)
	})
})

describe('paid-month boundaries', () => {
	it.each([
		['2027-01-31T09:15:00Z', '2027-02-28T09:15:00Z'],
		['2028-01-31T09:15:00Z', '2028-02-29T09:15:00Z'],
		['2027-12-15T09:15:00Z', '2028-01-15T09:15:00Z'],
	])('clamps %s to %s', (start, end) => {
		expect(nextAdMonth(new Date(start))).toEqual(new Date(end))
	})
})
