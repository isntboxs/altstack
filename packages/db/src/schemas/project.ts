import { sql } from 'drizzle-orm'
import {
	check,
	customType,
	index,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core'

import { PROJECT_STATUS } from '@altstack/shared/constants'
import type { ProjectStatus } from '@altstack/shared/constants'

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
		status: text('status').$type<ProjectStatus>().notNull(),
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
		check(
			'projects_status_check',
			sql`${table.status} in (${sql.join(
				PROJECT_STATUS.map((status) =>
					sql.raw(`'${status.replaceAll("'", "''")}'`)
				),
				sql.raw(', ')
			)})`
		),
	]
)
