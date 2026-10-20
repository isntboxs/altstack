import {
	index,
	pgTable,
	primaryKey,
	timestamp,
	uuid,
} from 'drizzle-orm/pg-core'

import { user } from '@altstack/db/schemas/auth'
import { project } from '@altstack/db/schemas/project'

export const bookmark = pgTable(
	'bookmarks',
	{
		userId: uuid('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		projectId: uuid('project_id')
			.notNull()
			.references(() => project.id, { onDelete: 'cascade' }),
		createdAt: timestamp('created_at').defaultNow().notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.userId, table.projectId] }),
		index('bookmarks_user_created_idx').on(
			table.userId,
			table.createdAt.desc(),
			table.projectId.desc()
		),
		index('bookmarks_project_idx').on(table.projectId),
	]
)
