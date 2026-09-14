import { sql } from 'drizzle-orm'
import {
	index,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
} from 'drizzle-orm/pg-core'

import { user } from '@altstack/db/schemas/auth'

export const submissionStatusEnum = pgEnum('submission_status', [
	'pending',
	'approved',
	'rejected',
])

export const submission = pgTable(
	'submissions',
	{
		id: uuid('id')
			.default(sql`pg_catalog.gen_random_uuid()`)
			.primaryKey(),
		name: text('name').notNull(),
		submitterId: uuid('submitter_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		repositoryUrl: text('repository_url').notNull().unique(),
		websiteUrl: text('website_url'),
		status: submissionStatusEnum('status').notNull().default('pending'),
		rejectionReason: text('rejection_reason'),
		submittedAt: timestamp('submitted_at').defaultNow().notNull(),
		moderatedAt: timestamp('moderated_at'),
		moderatedBy: uuid('moderated_by').references(() => user.id, {
			onDelete: 'set null',
		}),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		index('submission_submitterId_idx').on(table.submitterId),
		index('submission_status_idx').on(table.status),
	]
)
