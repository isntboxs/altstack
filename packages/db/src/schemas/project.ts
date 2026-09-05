import { sql } from 'drizzle-orm'
import {
	customType,
	index,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core'

const PROJECT_STATUS = ['draft', 'published', 'rejected', 'removed'] as const

export const projectStatusEnum = pgEnum('project_status', PROJECT_STATUS)

export const project = pgTable(
	'projects',
	{
		id: uuid('id')
			.default(sql`pg_catalog.gen_random_uuid()`)
			.primaryKey(),
		name: text('name').notNull(),
		slug: text('slug').notNull().unique(),
		tagline: varchar('tagline', { length: 100 }).notNull(),
		description: varchar('description', { length: 300 }).notNull(),
		logo: text('logo').notNull(),
		repositoryUrl: text('repository_url').notNull().unique(),
		websiteUrl: text('website_url'),
		content: text('content'),
		status: projectStatusEnum('status').notNull(),
		searchVector: customType<{ data: string }>({
			dataType: () => 'tsvector',
		})('search_vector').generatedAlwaysAs(
			sql`setweight(to_tsvector('english', coalesce("name", '')), 'A') || setweight(to_tsvector('english', coalesce("tagline", '')), 'B') || setweight(to_tsvector('english', coalesce("description", '')), 'C')`
		),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		index('project_slug_idx').on(table.slug),
		index('project_status_idx').on(table.status),
		index('project_search_vector_idx').using('gin', table.searchVector),
	]
)
