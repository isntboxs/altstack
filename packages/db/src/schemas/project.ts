import { sql } from 'drizzle-orm'
import type { SQLWrapper } from 'drizzle-orm'
import {
	check,
	customType,
	index,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core'

import { user } from '@altstack/db/schemas/auth'

import { PROJECT_STATUS } from '@altstack/shared/constants'
import type { ProjectStatus } from '@altstack/shared/constants'

// Covers legacy case, HTTP/www, trailing slash and .git variants as well as
// canonical URLs written by the API. The same expression is used in preflight.
export const canonicalRepositoryKey = (column: SQLWrapper) =>
	sql`lower(regexp_replace(regexp_replace(rtrim(${column}, '/'), '^https?://(www[.])?github[.]com/', 'https://github.com/', 'i'), '[.]git$', '', 'i'))`

export const project = pgTable(
	'projects',
	{
		id: uuid('id')
			.default(sql`pg_catalog.gen_random_uuid()`)
			.primaryKey(),
		name: text('name').notNull(),
		slug: text('slug').notNull().unique(),
		tagline: varchar('tagline', { length: 100 }),
		description: varchar('description', { length: 300 }),
		logo: text('logo'),
		submitterId: uuid('submitter_id').references(() => user.id, {
			onDelete: 'set null',
		}),
		rejectionReason: text('rejection_reason'),
		screenshot: text('screenshot'),
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
		uniqueIndex('projects_repository_canonical_idx').on(
			canonicalRepositoryKey(table.repositoryUrl)
		),
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
