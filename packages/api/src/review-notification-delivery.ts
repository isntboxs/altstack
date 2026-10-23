import { render } from '@react-email/render'
import { and, asc, eq, isNull, lte, or } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { createElement } from 'react'
import { Resend } from 'resend'
import { z } from 'zod'

import type { db } from '@altstack/db'
import { reviewNotification, user } from '@altstack/db/schemas'
import type { ReviewEmailPayload } from '@altstack/db/schemas/review-notification'

import { env } from '@altstack/env/server'

import { SubmissionPublishedEmail } from '@altstack/ui/emails/submission-published'
import { SubmissionRejectedEmail } from '@altstack/ui/emails/submission-rejected'

export const REVIEW_EMAIL_MAX_ATTEMPTS = 8
export const REVIEW_EMAIL_RETRY_WINDOW_MS = 23 * 60 * 60_000
export const REVIEW_EMAIL_LEASE_MS = 5 * 60_000
const retryDelays = [1, 5, 15, 30, 60, 120, 240].map(
	(minutes) => minutes * 60_000
)

export interface ReviewEmailConfig {
	appUrl: string
	from: string
}
type Notification = typeof reviewNotification.$inferSelect
type Send = (
	payload: ReviewEmailPayload,
	idempotencyKey: string
) => Promise<void>

export function reviewEmailConfig(
	settings: Pick<
		typeof env,
		| 'RESEND_API_KEY'
		| 'RESEND_FROM_EMAIL'
		| 'EMAIL_APP_URL'
		| 'CORS_ORIGINS'
		| 'NODE_ENV'
	> = env
): ReviewEmailConfig | null {
	if (
		!settings.RESEND_API_KEY ||
		!settings.RESEND_FROM_EMAIL ||
		!settings.EMAIL_APP_URL
	) {
		return null
	}
	try {
		const url = new URL(settings.EMAIL_APP_URL)
		const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
		if (
			url.username ||
			url.password ||
			url.pathname !== '/' ||
			url.search ||
			url.hash ||
			!settings.CORS_ORIGINS.includes(url.origin) ||
			(url.protocol !== 'https:' &&
				!(
					settings.NODE_ENV !== 'production' &&
					local &&
					url.protocol === 'http:'
				))
		) {
			return null
		}
		return {
			appUrl: url.origin,
			from: `AltStack <${settings.RESEND_FROM_EMAIL}>`,
		}
	} catch {
		return null
	}
}

async function sendReviewEmail(
	payload: ReviewEmailPayload,
	idempotencyKey: string
) {
	const { data, error } = await new Resend(env.RESEND_API_KEY).emails.send(
		// Keep JSON field order stable after a round-trip through jsonb.
		{
			from: payload.from,
			to: payload.to,
			subject: payload.subject,
			html: payload.html,
			text: payload.text,
		},
		{
			idempotencyKey,
			signal: AbortSignal.timeout(15_000),
		}
	)
	// Discard provider errors; they can include recipient addresses/content.
	if (error || !data.id) throw new Error('Review email delivery failed')
}

async function renderPayload(
	row: Notification,
	to: string,
	config: ReviewEmailConfig
): Promise<ReviewEmailPayload> {
	// Build from the configured trusted web origin, never repository/website input.
	// Public detail lives at /$slug; private /submission already preserves a safe
	// sign-in returnTo and provides the existing Edit & Resubmit action.
	if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.projectSlug)) {
		throw new Error('Invalid project slug')
	}
	const props = {
		appUrl: config.appUrl,
		projectName: row.projectName,
		submissionUrl: new URL('/submission', config.appUrl).href,
	}
	const template =
		row.outcome === 'published'
			? createElement(SubmissionPublishedEmail, {
					...props,
					projectUrl: new URL(`/${row.projectSlug}`, config.appUrl).href,
				})
			: createElement(SubmissionRejectedEmail, {
					...props,
					rejectionReason: row.rejectionReason!,
				})
	return {
		from: config.from,
		to,
		// Keep untrusted project names/feedback out of headers and telemetry.
		subject:
			row.outcome === 'published'
				? 'Your submission is published | AltStack'
				: 'Your submission needs changes | AltStack',
		html: await render(template),
		text: await render(template, { plainText: true }),
	}
}

// No HTTP handler: run from the private scheduled CLI. It reads committed rows
// only. Claim + frozen payload commit before any external side effect.
export async function runReviewNotificationBatch(
	database: typeof db,
	options: {
		config?: ReviewEmailConfig | null
		send?: Send
		now?: () => Date
		limit?: number
	} = {}
) {
	const summary = {
		claimed: 0,
		sent: 0,
		retry: 0,
		failed: 0,
		cancelled: 0,
		skipped: false,
	}
	const config =
		options.config === undefined ? reviewEmailConfig() : options.config
	if (!config) {
		summary.skipped = true
		return summary
	}
	const send = options.send ?? sendReviewEmail
	const now = options.now ?? (() => new Date())
	const limit = Math.min(100, Math.max(1, options.limit ?? 25))
	for (let index = 0; index < limit; index++) {
		const claim = await database.transaction(async (tx) => {
			const time = now()
			const [row] = await tx
				.select()
				.from(reviewNotification)
				.where(
					and(
						eq(reviewNotification.status, 'pending'),
						lte(reviewNotification.nextAttemptAt, time),
						or(
							isNull(reviewNotification.leaseUntil),
							lte(reviewNotification.leaseUntil, time)
						)
					)
				)
				.orderBy(
					asc(reviewNotification.nextAttemptAt),
					asc(reviewNotification.id)
				)
				.limit(1)
				.for('update', { skipLocked: true })
			if (!row) return null
			if (
				row.attempts >= REVIEW_EMAIL_MAX_ATTEMPTS ||
				(row.firstAttemptAt &&
					time.getTime() - row.firstAttemptAt.getTime() >=
						REVIEW_EMAIL_RETRY_WINDOW_MS)
			) {
				await tx
					.update(reviewNotification)
					.set({
						status: 'failed',
						lastError: 'retry_exhausted',
						leaseToken: null,
						leaseUntil: null,
					})
					.where(eq(reviewNotification.id, row.id))
				return { outcome: 'failed' as const }
			}
			const [recipient] = await tx
				.select({ email: user.email })
				.from(user)
				.where(eq(user.id, row.recipientId))
				.limit(1)
			if (
				!recipient ||
				!z.email().safeParse(recipient.email).success ||
				(row.payload && row.payload.to !== recipient.email)
			) {
				await tx
					.update(reviewNotification)
					.set({
						status: 'cancelled',
						lastError: 'recipient_changed',
						leaseToken: null,
						leaseUntil: null,
					})
					.where(eq(reviewNotification.id, row.id))
				return { outcome: 'cancelled' as const }
			}
			let payload: ReviewEmailPayload
			try {
				payload =
					row.payload ?? (await renderPayload(row, recipient.email, config))
			} catch {
				await tx
					.update(reviewNotification)
					.set({ status: 'failed', lastError: 'delivery_failed' })
					.where(eq(reviewNotification.id, row.id))
				return { outcome: 'failed' as const }
			}
			const token = randomUUID()
			const attempts = row.attempts + 1
			await tx
				.update(reviewNotification)
				.set({
					payload,
					attempts,
					firstAttemptAt: row.firstAttemptAt ?? time,
					leaseToken: token,
					leaseUntil: new Date(time.getTime() + REVIEW_EMAIL_LEASE_MS),
				})
				.where(eq(reviewNotification.id, row.id))
			return {
				outcome: 'send' as const,
				id: row.id,
				token,
				payload,
				attempts,
				firstAttemptAt: row.firstAttemptAt ?? time,
			}
		})
		if (!claim) break
		summary.claimed++
		if (claim.outcome !== 'send') {
			summary[claim.outcome]++
			continue
		}
		// DB failures updating the receipt intentionally escape: a restart recovers
		// the lease and uses the same provider key, within its bounded retry window.
		let accepted = false
		try {
			await send(claim.payload, `submission-review/${claim.id}`)
			accepted = true
		} catch {
			/* Persist only a fixed code, never the raw provider exception. */
		}
		const time = now()
		const exhausted =
			claim.attempts >= REVIEW_EMAIL_MAX_ATTEMPTS ||
			time.getTime() - claim.firstAttemptAt.getTime() >=
				REVIEW_EMAIL_RETRY_WINDOW_MS
		const status = accepted ? 'sent' : exhausted ? 'failed' : 'pending'
		await database
			.update(reviewNotification)
			.set({
				status,
				sentAt: accepted ? time : null,
				leaseToken: null,
				leaseUntil: null,
				lastError: accepted
					? null
					: exhausted
						? 'retry_exhausted'
						: 'delivery_failed',
				nextAttemptAt: new Date(
					time.getTime() + (retryDelays[claim.attempts - 1] ?? 240 * 60_000)
				),
			})
			.where(
				and(
					eq(reviewNotification.id, claim.id),
					eq(reviewNotification.leaseToken, claim.token)
				)
			)
		if (accepted) summary.sent++
		else if (exhausted) summary.failed++
		else summary.retry++
	}
	return summary
}
