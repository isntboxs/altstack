import { sql } from 'drizzle-orm'
import {
	check,
	integer,
	pgTable,
	text,
	timestamp,
	varchar,
} from 'drizzle-orm/pg-core'

export const aboutPage = pgTable(
	'about_page',
	{
		id: text('id').primaryKey().default('about'),
		title: varchar('title', { length: 200 }).notNull(),
		description: varchar('description', { length: 500 }).notNull(),
		content: text('content').notNull(),
		version: integer('version').notNull().default(1),
		updatedAt: timestamp('updated_at').defaultNow().notNull(),
	},
	(table) => [
		check('about_page_singleton_check', sql`${table.id} = 'about'`),
		check('about_page_version_check', sql`${table.version} > 0`),
	]
)
