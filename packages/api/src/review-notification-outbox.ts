import { eq } from 'drizzle-orm'
import { z } from 'zod'

import type { db } from '@altstack/db'
import { reviewNotification, user } from '@altstack/db/schemas'

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

// Called inside the review transaction, only after its revision/lock checks.
export async function enqueueReviewNotification(
	tx: Transaction,
	decision: {
		eventId: string
		fromStatus: string
		project: {
			id: string
			name: string
			slug: string
			status: string
			submitterId: string | null
			rejectionReason: string | null
		}
	}
) {
	const row = decision.project
	if (
		decision.fromStatus === row.status ||
		!row.submitterId ||
		(row.status !== 'published' && row.status !== 'rejected')
	) {
		return
	}
	const [recipient] = await tx
		.select({ email: user.email })
		.from(user)
		.where(eq(user.id, row.submitterId))
		.limit(1)
	if (!recipient || !z.email().safeParse(recipient.email).success) return
	await tx
		.insert(reviewNotification)
		.values({
			id: decision.eventId,
			projectId: row.id,
			recipientId: row.submitterId,
			projectName: row.name,
			projectSlug: row.slug,
			outcome: row.status,
			rejectionReason: row.status === 'rejected' ? row.rejectionReason : null,
		})
		.onConflictDoNothing({ target: reviewNotification.id })
}
