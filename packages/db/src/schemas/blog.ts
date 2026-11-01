import { sql } from 'drizzle-orm'
import {
	check,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core'

import { user } from '@altstack/db/schemas/auth'

export const blogPost = pgTable(
	'blog_posts',
	{
		id: uuid('id')
			.default(sql`pg_catalog.gen_random_uuid()`)
			.primaryKey(),
		title: varchar('title', { length: 200 }).notNull(),
		slug: varchar('slug', { length: 160 }).notNull().unique(),
		description: varchar('description', { length: 500 }).notNull(),
		coverUrl: text('cover_url').notNull(),
		content: text('content').notNull(),
		status: text('status')
			.$type<'draft' | 'published'>()
			.notNull()
			.default('draft'),
		authorId: uuid('author_id').references(() => user.id, {
			onDelete: 'set null',
		}),
		// Keep the byline if the author's account is deleted.
		authorName: text('author_name').notNull(),
		readTime: integer('read_time').notNull(),
		version: integer('version').notNull().default(1),
		publishedAt: timestamp('published_at'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull(),
	},
	(t) => [
		index('blog_posts_status_published_idx').on(t.status, t.publishedAt),
		check(
			'blog_posts_status_check',
			sql`${t.status} IN ('draft', 'published')`
		),
		check(
			'blog_posts_publication_check',
			sql`${t.status} <> 'published' OR ${t.publishedAt} IS NOT NULL`
		),
		check('blog_posts_version_check', sql`${t.version} > 0`),
		check('blog_posts_read_time_check', sql`${t.readTime} > 0`),
	]
)
