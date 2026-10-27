import { APIError } from 'better-auth/api'
import { sql } from 'drizzle-orm'
import { createHmac } from 'node:crypto'

import type { db } from '@altstack/db'
import { rateLimit } from '@altstack/db/schemas'

export const MAGIC_LINK_RATE_LIMIT = { window: 60 * 10, max: 5 }

// Keep a day of inactive buckets, beyond every currently configured auth window.
export const AUTH_RATE_LIMIT_RETENTION_MS = 24 * 60 * 60 * 1000

export async function pruneExpiredAuthRateLimits(
	database: typeof db,
	now = Date.now()
) {
	const cutoff = now - AUTH_RATE_LIMIT_RETENTION_MS
	// Recheck last_request under the DELETE row lock so refreshed quotas survive.
	// Return a count rather than transferring recipient/IP keys to the job logger.
	const result = await database.execute<{ deleted: number }>(sql`
		WITH deleted AS (
			DELETE FROM ${rateLimit} WHERE ${rateLimit.lastRequest} < ${cutoff}
			RETURNING 1
		)
		SELECT count(*)::int AS deleted FROM deleted
	`)
	return { cutoff, deleted: result.rows[0]!.deleted }
}

export function createMagicLinkRecipientLimiter(
	database: Pick<typeof db, 'insert'>,
	secret: string
) {
	return async (email: string) => {
		const key = `magic-link-recipient:${createHmac('sha256', secret)
			.update(email.trim().toLowerCase())
			.digest('hex')}`
		const now = Date.now()
		const windowMs = MAGIC_LINK_RATE_LIMIT.window * 1000
		const expired = sql`${rateLimit.lastRequest} <= ${now - windowMs}`
		let bucket
		try {
			// The unique key serializes concurrent inserts/updates across servers.
			// Bound the counter and leave the window unchanged on denied requests.
			const result = await database
				.insert(rateLimit)
				.values({ key, count: 1, lastRequest: now })
				.onConflictDoUpdate({
					target: rateLimit.key,
					set: {
						count: sql`case when ${expired} then 1 else least(${rateLimit.count} + 1, ${MAGIC_LINK_RATE_LIMIT.max + 1}) end`,
						lastRequest: sql`case when ${expired} or ${rateLimit.count} < ${MAGIC_LINK_RATE_LIMIT.max} then ${now} else ${rateLimit.lastRequest} end`,
					},
				})
				.returning({
					count: rateLimit.count,
					lastRequest: rateLimit.lastRequest,
				})
			bucket = result[0]
		} catch {
			throw new APIError('SERVICE_UNAVAILABLE', {
				message:
					'Email sign-in is temporarily unavailable. Please try again later.',
			})
		}
		if (!bucket) {
			throw new APIError('SERVICE_UNAVAILABLE', {
				message:
					'Email sign-in is temporarily unavailable. Please try again later.',
			})
		}
		if (bucket.count > MAGIC_LINK_RATE_LIMIT.max) {
			const retryAfter = Math.max(
				1,
				Math.ceil((bucket.lastRequest + windowMs - now) / 1000)
			)
			throw new APIError(
				'TOO_MANY_REQUESTS',
				{ message: 'Too many requests. Please try again later.' },
				{ 'X-Retry-After': retryAfter.toString() }
			)
		}
	}
}
