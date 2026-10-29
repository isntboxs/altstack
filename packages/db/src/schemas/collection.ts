import { sql } from 'drizzle-orm'
import {
	check,
	index,
	integer,
	pgTable,
	primaryKey,
	text,
	timestamp,
	unique,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core'

import { user } from '@altstack/db/schemas/auth'
import { project } from '@altstack/db/schemas/project'

export const collection = pgTable(
	'collections',
	{
		id: uuid('id')
			.default(sql`pg_catalog.gen_random_uuid()`)
			.primaryKey(),
		name: varchar('name', { length: 120 }).notNull(),
		slug: varchar('slug', { length: 100 }).notNull().unique(),
		description: varchar('description', { length: 300 }).notNull(),
		content: text('content').notNull(),
		kind: text('kind')
			.$type<'alternatives' | 'repository' | 'ecosystem'>()
			.notNull(),
		status: text('status')
			.$type<'draft' | 'published'>()
			.notNull()
			.default('draft'),
		sourceRepositoryUrl: text('source_repository_url'),
		mainProjectId: uuid('main_project_id').references(() => project.id, {
			onDelete: 'set null',
		}),
		authorId: uuid('author_id').references(() => user.id, {
			onDelete: 'set null',
		}),
		// Authenticated author's name at creation remains available after account deletion.
		authorName: text('author_name').notNull(),
		version: integer('version').notNull().default(1),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull(),
	},
	(t) => [
		index('collections_status_updated_idx').on(t.status, t.updatedAt),
		index('collections_main_project_idx').on(t.mainProjectId),
		check(
			'collections_kind_check',
			sql`${t.kind} IN ('alternatives','repository','ecosystem')`
		),
		check(
			'collections_status_check',
			sql`${t.status} IN ('draft','published')`
		),
		// A removed target may become null. Public eligibility then hides the collection.
		check(
			'collections_source_check',
			sql`(${t.kind} = 'repository' AND ${t.sourceRepositoryUrl} IS NOT NULL AND ${t.mainProjectId} IS NULL) OR (${t.kind} <> 'repository' AND ${t.sourceRepositoryUrl} IS NULL)`
		),
		check('collections_version_check', sql`${t.version} > 0`),
	]
)
export const collectionMember = pgTable(
	'collection_members',
	{
		collectionId: uuid('collection_id')
			.notNull()
			.references(() => collection.id, { onDelete: 'cascade' }),
		projectId: uuid('project_id')
			.notNull()
			.references(() => project.id, { onDelete: 'cascade' }),
		position: integer('position').notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.collectionId, t.projectId] }),
		unique('collection_members_position_unique').on(t.collectionId, t.position),
		index('collection_members_project_idx').on(t.projectId),
		check(
			'collection_members_position_check',
			sql`${t.position} >= 0 AND ${t.position} < 100`
		),
	]
)
