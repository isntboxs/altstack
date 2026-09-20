import { sql } from 'drizzle-orm'
import {
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
} from 'drizzle-orm/pg-core'

import { user } from '@altstack/db/schemas/auth'
import { project } from '@altstack/db/schemas/project'

export const AUDIT_STATUS = ['project_removed'] as const

export type AuditAction = (typeof AUDIT_STATUS)[number]

export const auditLog = pgTable(
	'audit_log',
	{
		id: uuid('id')
			.default(sql`pg_catalog.gen_random_uuid()`)
			.primaryKey(),
		actorId: uuid('actor_id').references(() => user.id, {
			onDelete: 'set null',
		}),
		action: text('action').$type<AuditAction>().notNull(),
		projectId: uuid('project_id').references(() => project.id, {
			onDelete: 'set null',
		}),
		reason: text('reason'),
		metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
		createdAt: timestamp('created_at').defaultNow().notNull(),
	},
	(table) => [
		index('audit_log_actorId_idx').on(table.actorId),
		index('audit_log_projectId_idx').on(table.projectId),
		index('audit_log_createdAt_idx').on(table.createdAt),
	]
)
