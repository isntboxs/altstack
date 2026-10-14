import { ORPCError } from '@orpc/server'
import { and, count, eq, sql } from 'drizzle-orm'

import type { db } from '@altstack/db'
import { project } from '@altstack/db/schemas'

export async function requireSubmissionCapacity(
	database: Pick<typeof db, 'select'>,
	userId: string
) {
	const [open] = await database
		.select({ count: count() })
		.from(project)
		.where(and(eq(project.submitterId, userId), eq(project.status, 'draft')))
	if ((open?.count ?? 0) >= 10) {
		throw new ORPCError('TOO_MANY_REQUESTS', {
			message:
				'You have 10 submissions awaiting review. Please wait for a review before submitting more.',
		})
	}
}

// Create and resubmit must acquire the same per-account lock before counting.
export async function lockSubmissionCapacity(
	database: Pick<typeof db, 'execute'>,
	userId: string
) {
	await database.execute(
		sql`SELECT pg_advisory_xact_lock(hashtext('altstack.submission-capacity'), hashtext(${userId}))`
	)
}
