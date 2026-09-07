import { sql } from 'drizzle-orm'
import {
	index,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid,
} from 'drizzle-orm/pg-core'

import { project } from '@altstack/db/schemas/project'

export const category = pgTable(
	'categories',
	{
		id: uuid('id')
			.default(sql`pg_catalog.gen_random_uuid()`)
			.primaryKey(),
		slug: text('slug').notNull().unique(),
		name: text('name').notNull(),
		description: text('description'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index('category_slug_idx').on(table.slug)]
)

export const projectCategory = pgTable(
	'project_categories',
	{
		projectId: uuid('project_id')
			.notNull()
			.references(() => project.id, { onDelete: 'cascade' }),
		categoryId: uuid('category_id')
			.notNull()
			.references(() => category.id, { onDelete: 'cascade' }),
	},
	(table) => [
		primaryKey({ columns: [table.projectId, table.categoryId] }),
		index('project_category_category_idx').on(table.categoryId),
	]
)
