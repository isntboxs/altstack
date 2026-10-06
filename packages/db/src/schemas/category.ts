import { sql } from 'drizzle-orm'
import {
	check,
	foreignKey,
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
		parentId: uuid('parent_id'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		index('category_slug_idx').on(table.slug),
		index('category_parent_idx').on(table.parentId),
		foreignKey({
			columns: [table.parentId],
			foreignColumns: [table.id],
		}).onDelete('restrict'),
		check(
			'categories_not_self_parent_check',
			sql`${table.parentId} <> ${table.id}`
		),
	]
)

// Current and historical relative paths resolve directly to stable category IDs.
// The canonical path is derived from categories.parentId and the current slugs.
export const categoryPath = pgTable(
	'category_paths',
	{
		path: text('path').primaryKey(),
		categoryId: uuid('category_id')
			.notNull()
			.references(() => category.id, { onDelete: 'cascade' }),
	},
	(table) => [index('category_path_category_idx').on(table.categoryId)]
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
