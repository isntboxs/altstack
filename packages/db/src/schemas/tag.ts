import { sql } from 'drizzle-orm'
import {
	boolean,
	check,
	index,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid,
} from 'drizzle-orm/pg-core'

import { project } from '@altstack/db/schemas/project'

export const tag = pgTable(
	'tags',
	{
		id: uuid('id')
			.default(sql`pg_catalog.gen_random_uuid()`)
			.primaryKey(),
		// Immutable GitHub topic identity; the display name may be curated.
		slug: text('slug').notNull().unique(),
		name: text('name').notNull(),
		description: text('description'),
		hidden: boolean('hidden').notNull().default(false),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		check('tags_slug_check', sql`${table.slug} ~ '^[a-z0-9][a-z0-9-]{0,49}$'`),
	]
)

export const projectTag = pgTable(
	'project_tags',
	{
		projectId: uuid('project_id')
			.notNull()
			.references(() => project.id, { onDelete: 'cascade' }),
		tagId: uuid('tag_id')
			.notNull()
			.references(() => tag.id, { onDelete: 'restrict' }),
	},
	(table) => [
		primaryKey({ columns: [table.projectId, table.tagId] }),
		index('project_tag_tag_idx').on(table.tagId),
	]
)
