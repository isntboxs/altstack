import { sql } from 'drizzle-orm'
import {
	check,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
} from 'drizzle-orm/pg-core'

import { auditLog } from '@altstack/db/schemas/audit'
import { user } from '@altstack/db/schemas/auth'
import { project } from '@altstack/db/schemas/project'

export interface ReviewEmailPayload {
	from: string
	to: string
	subject: string
	html: string
	text: string
}

// Private outbox. Never include this table/payload in public project projections.
export const reviewNotification = pgTable(
	'submission_review_notifications',
	{
		// The committed audit event is the durable transition and idempotency identity.
		id: uuid('id')
			.primaryKey()
			.references(() => auditLog.id, { onDelete: 'cascade' }),
		projectId: uuid('project_id')
			.notNull()
			.references(() => project.id, { onDelete: 'cascade' }),
		recipientId: uuid('recipient_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		projectName: text('project_name').notNull(),
		projectSlug: text('project_slug').notNull(),
		outcome: text('outcome').$type<'published' | 'rejected'>().notNull(),
		rejectionReason: text('rejection_reason'),
		status: text('status')
			.$type<'pending' | 'sent' | 'failed' | 'cancelled'>()
			.notNull()
			.default('pending'),
		attempts: integer('attempts').notNull().default(0),
		nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true })
			.notNull()
			.defaultNow(),
		firstAttemptAt: timestamp('first_attempt_at', { withTimezone: true }),
		leaseUntil: timestamp('lease_until', { withTimezone: true }),
		leaseToken: uuid('lease_token'),
		// Frozen before the first provider call so retries use identical request bytes,
		// including after a deployment, sender change or project content edit.
		payload: jsonb('payload').$type<ReviewEmailPayload>(),
		lastError: text('last_error').$type<
			'delivery_failed' | 'retry_exhausted' | 'recipient_changed'
		>(),
		sentAt: timestamp('sent_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index('review_notifications_due_idx')
			.on(table.nextAttemptAt)
			.where(sql`${table.status} = 'pending'`),
		check(
			'review_notifications_outcome_check',
			sql`${table.outcome} in ('published', 'rejected')`
		),
		check(
			'review_notifications_status_check',
			sql`${table.status} in ('pending', 'sent', 'failed', 'cancelled')`
		),
		check('review_notifications_attempts_check', sql`${table.attempts} >= 0`),
		check(
			'review_notifications_feedback_check',
			sql`${table.outcome} <> 'rejected' or length(trim(${table.rejectionReason})) > 0 and ${table.rejectionReason} is not null`
		),
	]
)
