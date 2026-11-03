import { render } from '@react-email/render'
import { and, eq, lte, or, isNull, sql, asc } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { createElement } from 'react'
import { Resend } from 'resend'

import type { db } from '@altstack/db'
import { adNotification, adOrder } from '@altstack/db/schemas'

import { env } from '@altstack/env/server'

import { AD_PLANS } from '@altstack/shared/schemas/ad-billing'

import { AdCampaignEmail } from '@altstack/ui/emails/ad-campaign'

import { adAccessToken } from './ad-access'
import { reviewEmailConfig } from './review-notification-delivery'

type Notice = typeof adNotification.$inferSelect
type Payload = NonNullable<Notice['payload']>
export function adEmailConfig() {
	const config = reviewEmailConfig()
	return config
		? {
				...config,
				contactEmail: env.ADS_CONTACT_EMAIL ?? env.RESEND_FROM_EMAIL!,
			}
		: null
}
export async function queueAdNotification(
	database: Pick<typeof db, 'insert'>,
	orderId: string,
	kind: Notice['kind'],
	eventKey: string,
	reason?: string
) {
	await database
		.insert(adNotification)
		.values({ orderId, kind, eventKey, reason })
		.onConflictDoNothing({ target: adNotification.eventKey })
	if (['ordered', 'submitted', 'renewal_requested'].includes(kind)) {
		await database
			.insert(adNotification)
			.values({
				orderId,
				kind,
				eventKey: `${eventKey}:admin`,
				reason,
				audience: 'admin',
			})
			.onConflictDoNothing({ target: adNotification.eventKey })
	}
}
const messages = {
	access: 'Use this private link to manage your advertising order.',
	ordered:
		'Your order is received. Open your private management link to find your order reference and pay through Ko-fi. Use the same contact email and include your order reference in your Ko-fi message. No payment has been taken by AltStack. Our team confirms receipt manually; your month starts when the paid campaign is approved.',
	paid: 'The team has confirmed your payment. Upload your advertising materials for review. Your paid month begins when your campaign is approved.',
	submitted:
		'Your advertising materials are waiting for review. Previously approved artwork stays in place while a revision is reviewed.',
	approved:
		'Your advertising materials have been approved. Check your campaign dates below. Renewals require a new payment confirmed by the team.',
	revision:
		'Your campaign needs a revision. Check the feedback and update your materials.',
	rejected:
		'Your submission was declined. Check the feedback below. For a declined first campaign, reply to arrange a manual refund with the team.',
	renewal_requested:
		'Your renewal request is received. Open your private management link to pay for another month through Ko-fi. Use the same contact email and include your order reference in your Ko-fi message. Already paid? Wait for confirmation; do not pay again. Your campaign dates change only after the team confirms receipt.',
	renewed:
		'The team has confirmed your renewal payment and extended your campaign by one month.',
}
async function sendAdEmail(payload: Payload, key: string) {
	const { data, error } = await new Resend(env.RESEND_API_KEY).emails.send(
		{
			from: payload.from,
			to: payload.to,
			replyTo: payload.replyTo,
			subject: payload.subject,
			html: payload.html,
			text: payload.text,
		},
		{ idempotencyKey: key, signal: AbortSignal.timeout(15000) }
	)
	if (error || !data.id) throw new Error('Ad email delivery failed')
}
export async function runAdNotificationBatch(
	database: typeof db,
	options: {
		limit?: number
		now?: () => Date
		send?: (payload: Payload, key: string) => Promise<void>
		config?: ReturnType<typeof adEmailConfig>
	} = {}
) {
	const config = options.config === undefined ? adEmailConfig() : options.config
	if (!config) return { sent: 0, failed: 0, configured: false }
	const time = options.now ?? (() => new Date()),
		send = options.send ?? sendAdEmail
	let sent = 0,
		failed = 0
	for (let i = 0; i < Math.min(100, options.limit ?? 10); i++) {
		const now = time(),
			leaseToken = randomUUID()
		const notice = await database.transaction(async (tx) => {
			const [row] = await tx
				.select()
				.from(adNotification)
				.where(
					and(
						eq(adNotification.status, 'pending'),
						lte(adNotification.nextAttemptAt, now),
						or(
							isNull(adNotification.leaseUntil),
							lte(adNotification.leaseUntil, now)
						)
					)
				)
				.orderBy(asc(adNotification.createdAt), asc(adNotification.id))
				.limit(1)
				.for('update', { skipLocked: true })
			if (!row) return null
			if (
				row.attempts >= 8 ||
				now.getTime() - row.createdAt.getTime() >= 23 * 60 * 60 * 1000
			) {
				await tx
					.update(adNotification)
					.set({ status: 'failed', leaseToken: null, leaseUntil: null })
					.where(eq(adNotification.id, row.id))
				return { failed: true as const }
			}
			const [order] = await tx
				.select()
				.from(adOrder)
				.where(eq(adOrder.id, row.orderId))
			if (!order) throw new Error('Ad notification order unavailable')
			let payload = row.payload
			if (!payload) {
				const admin = row.audience === 'admin'
				const manageUrl = admin
					? `${config.appUrl}/admin/ads`
					: `${config.appUrl}/advertise/manage#id=${order.id}&token=${adAccessToken(order, row.createdAt.getTime())}`
				const description = admin
					? `Order ${order.id}, ${AD_PLANS[order.plan].name}, US$${(order.amount / 100).toFixed(2)}, ${order.email}: ${row.kind.replaceAll('_', ' ')}. Match the Ko-fi payment to this order reference and contact email; confirm only after independently checking receipt.`
					: messages[row.kind]
				const message =
					description + (row.reason ? ` Feedback: ${row.reason}` : '')
				const props = {
					appUrl: config.appUrl,
					plan: AD_PLANS[order.plan].name,
					message,
					manageUrl,
					privateLink: !admin,
				}
				const [html, text] = await Promise.all([
					render(createElement(AdCampaignEmail, props)),
					render(createElement(AdCampaignEmail, props), { plainText: true }),
				])
				payload = {
					from: config.from,
					to: admin ? config.contactEmail : order.email,
					replyTo: admin ? order.email : config.contactEmail,
					subject: admin
						? 'Advertising order needs attention | AltStack'
						: `AltStack ${AD_PLANS[order.plan].name}: campaign update`,
					html,
					text,
				}
			}
			const [leased] = await tx
				.update(adNotification)
				.set({
					payload,
					leaseToken,
					leaseUntil: new Date(now.getTime() + 120000),
					attempts: sql`${adNotification.attempts}+1`,
				})
				.where(eq(adNotification.id, row.id))
				.returning()
			return { failed: false as const, row: leased!, payload }
		})
		if (!notice) break
		if (notice.failed) {
			failed++
			continue
		}
		let accepted = false
		try {
			await send(notice.payload, `ad-notice/${notice.row.id}`)
			accepted = true
		} catch {
			/* Provider exceptions can contain private links and recipients. */
		}
		const exhausted =
			notice.row.attempts >= 8 ||
			time().getTime() - notice.row.createdAt.getTime() >= 23 * 60 * 60 * 1000
		await database
			.update(adNotification)
			.set({
				status: accepted ? 'sent' : exhausted ? 'failed' : 'pending',
				sentAt: accepted ? time() : null,
				nextAttemptAt: new Date(
					time().getTime() + Math.min(2 ** notice.row.attempts, 240) * 60000
				),
				leaseUntil: null,
				leaseToken: null,
			})
			.where(
				and(
					eq(adNotification.id, notice.row.id),
					eq(adNotification.leaseToken, leaseToken)
				)
			)
		if (accepted) sent++
		else failed++
	}
	return { sent, failed, configured: true }
}
