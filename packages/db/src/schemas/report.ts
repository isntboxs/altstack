import { sql } from 'drizzle-orm'
import {
	check,
	index,
	pgTable,
	text,
	timestamp,
	uuid,
} from 'drizzle-orm/pg-core'

import { user } from '@altstack/db/schemas/auth'
import { project } from '@altstack/db/schemas/project'

// Private intake and moderation. Never add these fields to public projections.
export const projectReport = pgTable(
	'project_reports',
	{
		id: uuid('id')
			.default(sql`pg_catalog.gen_random_uuid()`)
			.primaryKey(),
		projectId: uuid('project_id').references(() => project.id, {
			onDelete: 'set null',
		}),
		userId: uuid('user_id').references(() => user.id, { onDelete: 'set null' }),
		email: text('email').notNull(),
		type: text('type', {
			enum: ['broken_link', 'wrong_category', 'outdated', 'other'],
		}).notNull(),
		message: text('message').notNull().default(''),
		status: text('status', { enum: ['open', 'resolved', 'dismissed'] })
			.notNull()
			.default('open'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
	},
	(table) => [
		index('project_reports_project_created_idx').on(
			table.projectId,
			table.createdAt.desc()
		),
		index('project_reports_user_idx').on(table.userId),
		index('project_reports_status_created_id_idx').on(
			table.status,
			table.createdAt.desc(),
			table.id.desc()
		),
		index('project_reports_created_id_idx').on(
			table.createdAt.desc(),
			table.id.desc()
		),
		check(
			'project_reports_status_check',
			sql`${table.status} IN ('open', 'resolved', 'dismissed')`
		),
		check(
			'project_reports_type_check',
			sql`${table.type} IN ('broken_link', 'wrong_category', 'outdated', 'other')`
		),
		check(
			'project_reports_email_check',
			sql`char_length(${table.email}) BETWEEN 3 AND 254 AND ${table.email} = btrim(${table.email})`
		),
		check(
			'project_reports_message_check',
			sql`char_length(${table.message}) <= 2000 AND ${table.message} = btrim(${table.message}) AND (${table.type} <> 'other' OR char_length(${table.message}) > 0)`
		),
	]
)
