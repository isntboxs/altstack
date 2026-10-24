import { ORPCError } from '@orpc/server'
import { sql } from 'drizzle-orm'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { isIP } from 'node:net'

import type { db } from '@altstack/db'
import { rateLimit } from '@altstack/db/schemas'

import { env } from '@altstack/env/server'

export const CLAIM_CODE_LIFETIME_MS = 10 * 60 * 1000
export const CLAIM_RESEND_MS = 60 * 1000
export function claimCodeHash(
	binding: {
		challengeId: string
		userId: string
		projectId: string
		email: string
		role: string
	},
	code: string
) {
	return createHmac('sha256', env.BETTER_AUTH_SECRET)
		.update(
			JSON.stringify([
				binding.challengeId,
				binding.userId,
				binding.projectId,
				binding.email,
				binding.role,
				code,
			])
		)
		.digest('hex')
}
export function matchesClaimCode(expected: string, actual: string) {
	const a = Buffer.from(expected, 'hex'),
		b = Buffer.from(actual, 'hex')
	return a.length === b.length && timingSafeEqual(a, b)
}
export function claimClientIp(headers?: Headers) {
	// Same trusted single-address reverse-proxy contract as Better Auth. Never
	// trust a chain or fall back to a caller-selected alternate header.
	const value = headers?.get('x-forwarded-for')?.trim()
	return value && isIP(value) ? value : 'unknown'
}
export async function enforceClaimQuota(
	database: typeof db,
	subject: string,
	max: number,
	now = Date.now()
) {
	const key =
		'project-claim:' +
		createHmac('sha256', env.BETTER_AUTH_SECRET).update(subject).digest('hex')
	const windowMs = 10 * 60 * 1000
	const expired = sql`${rateLimit.lastRequest} <= ${now - windowMs}`
	let row
	try {
		;[row] = await database
			.insert(rateLimit)
			.values({ key, count: 1, lastRequest: now })
			.onConflictDoUpdate({
				target: rateLimit.key,
				set: {
					count: sql`case when ${expired} then 1 else least(${rateLimit.count} + 1, ${max + 1}) end`,
					lastRequest: sql`case when ${expired} then ${now} else ${rateLimit.lastRequest} end`,
				},
			})
			.returning({ count: rateLimit.count })
	} catch {
		throw new ORPCError('SERVICE_UNAVAILABLE', {
			message: 'Verification is temporarily unavailable.',
		})
	}
	if (!row) throw new ORPCError('SERVICE_UNAVAILABLE')
	if (row.count > max) {
		throw new ORPCError('TOO_MANY_REQUESTS', {
			message:
				'Too many verification requests. Please try again in ten minutes.',
		})
	}
}
