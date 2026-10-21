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

// Private intake only. Never join these fields into public project projections.
export const projectReport = pgTable(
	'project_reports',
	{
		id: uuid('id')
			.default(sql`pg_catalog.gen_random_uuid()`)
			.primaryKey(),
		projectId: uuid('project_id')
			.notNull()
			.references(() => project.id, { onDelete: 'cascade' }),
		userId: uuid('user_id').references(() => user.id, { onDelete: 'set null' }),
		email: text('email').notNull(),
		type: text('type', {
			enum: ['broken_link', 'wrong_category', 'outdated', 'other'],
		}).notNull(),
		message: text('message').notNull().default(''),
		createdAt: timestamp('created_at').defaultNow().notNull(),
	},
	(table) => [
		index('project_reports_project_created_idx').on(
			table.projectId,
			table.createdAt.desc()
		),
		index('project_reports_user_idx').on(table.userId),
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
