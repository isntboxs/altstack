import { sql } from 'drizzle-orm'
import {
	pgTable,
	text,
	timestamp,
	uuid,
	index,
	varchar,
} from 'drizzle-orm/pg-core'

export const project = pgTable(
	'projects',
	{
		id: uuid('id')
			.default(sql`pg_catalog.gen_random_uuid()`)
			.primaryKey(),
		name: text('name').notNull(),
		slug: text('slug').notNull().unique(),
		tagline: varchar('tagline', { length: 80 }).notNull(),
		shortDescription: varchar('short_description', { length: 280 }).notNull(),
		logoUrl: text('logo_url').notNull(),
		repositoryUrl: text('repository_url').notNull().unique(),
		websiteUrl: text('website_url'),
		content: text('content'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index('project_slug_idx').on(table.slug)]
)
