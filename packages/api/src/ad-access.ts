import { ORPCError } from '@orpc/server'
import { eq } from 'drizzle-orm'
import { createHmac, timingSafeEqual } from 'node:crypto'

import type { db } from '@altstack/db'
import { adOrder } from '@altstack/db/schemas'

import { env } from '@altstack/env/server'

export const AD_ACCESS_LIFETIME_SECONDS = 24 * 60 * 60
export function adAccessToken(
	order: Pick<typeof adOrder.$inferSelect, 'id' | 'accessNonce'>,
	now = Date.now()
) {
	const expires = Math.floor(now / 1000) + AD_ACCESS_LIFETIME_SECONDS
	const signature = createHmac('sha256', env.BETTER_AUTH_SECRET)
		.update(`ad-management:v1:${order.id}:${order.accessNonce}:${expires}`)
		.digest('base64url')
	return `${expires}.${signature}`
}
export function validAdAccess(
	order: Pick<typeof adOrder.$inferSelect, 'id' | 'accessNonce'>,
	token: string,
	now = Date.now()
) {
	const [rawExpiry, signature, ...extra] = token.split('.')
	const expiry = Number(rawExpiry)
	if (
		extra.length > 0 ||
		!signature ||
		!Number.isSafeInteger(expiry) ||
		expiry <= now / 1000 ||
		expiry > now / 1000 + AD_ACCESS_LIFETIME_SECONDS + 60
	) {
		return false
	}
	const expected = createHmac('sha256', env.BETTER_AUTH_SECRET)
		.update(`ad-management:v1:${order.id}:${order.accessNonce}:${expiry}`)
		.digest('base64url')
	const a = Buffer.from(signature),
		b = Buffer.from(expected)
	return a.length === b.length && timingSafeEqual(a, b)
}
export async function requireAdAccess(
	database: typeof db,
	input: { id: string; token: string },
	paid = true
) {
	const [order] = await database
		.select()
		.from(adOrder)
		.where(eq(adOrder.id, input.id))
	if (!order || !validAdAccess(order, input.token)) {
		throw new ORPCError('UNAUTHORIZED', {
			message:
				'This management link is invalid or expired. Request a fresh link by email.',
		})
	}
	if (paid && !order.paidAt) {
		throw new ORPCError('FORBIDDEN', {
			message: 'Payment has not been confirmed yet.',
		})
	}
	return order
}
export function adOrderView(order: typeof adOrder.$inferSelect) {
	return {
		id: order.id,
		plan: order.plan,
		amount: order.amount,
		currency: order.currency,
		status: order.status,
		email: order.email,
		material: order.material,
		feedback: order.feedback,
		paidAt: order.paidAt,
		startsAt: order.startsAt,
		paidThrough: order.paidThrough,
		renewalRequestedAt: order.renewalRequestedAt,
		campaignId: order.campaignId,
		version: order.version,
		createdAt: order.createdAt,
	}
}
