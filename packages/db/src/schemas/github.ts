import { sql } from 'drizzle-orm'
import {
	pgTable,
	uuid,
	varchar,
	text,
	integer,
	boolean,
	timestamp,
	jsonb,
	bigint,
	index,
} from 'drizzle-orm/pg-core'

import { project } from '@altstack/db/schemas/project'

export const githubRepository = pgTable(
	'github_repositories',
	{
		id: uuid('id')
			.default(sql`pg_catalog.gen_random_uuid()`)
			.primaryKey(),
		projectId: uuid('project_id')
			.notNull()
			.unique()
			.references(() => project.id, { onDelete: 'cascade' }),
		githubId: bigint('github_id', { mode: 'number' }).notNull().unique(),
		nodeId: text('node_id').notNull(),
		owner: varchar('owner', { length: 100 }).notNull(),
		repo: varchar('repo', { length: 100 }).notNull(),
		fullName: varchar('full_name', { length: 200 }).notNull().unique(),
		description: text('description'),
		stars: integer('stars').default(0).notNull(),
		forks: integer('forks').default(0).notNull(),
		watchers: integer('watchers').default(0).notNull(),
		openIssues: integer('open_issues').default(0).notNull(),
		subscribersCount: integer('subscribers_count').default(0).notNull(),
		networkCount: integer('network_count').default(0).notNull(),
		contributorsCount: integer('contributors_count'),
		licenseSpdxId: varchar('license_spdx_id', { length: 50 }),
		licenseName: text('license_name'),
		language: varchar('language', { length: 50 }),
		topics: jsonb('topics').$type<Array<string>>().default([]),
		defaultBranch: varchar('default_branch', { length: 100 }),
		isArchived: boolean('is_archived').default(false).notNull(),
		isFork: boolean('is_fork').default(false).notNull(),
		isPrivate: boolean('is_private').default(false).notNull(),
		size: integer('size'),
		githubCreatedAt: timestamp('github_created_at'),
		githubUpdatedAt: timestamp('github_updated_at'),
		githubPushedAt: timestamp('github_pushed_at'),
		lastFetchedAt: timestamp('last_fetched_at').defaultNow().notNull(),
		etag: text('etag'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(t) => [
		index('gh_repo_project_id_idx').on(t.projectId),
		index('gh_repo_full_name_idx').on(t.fullName),
		index('gh_repo_stars_idx').on(t.stars),
		index('gh_repo_pushed_at_idx').on(t.githubPushedAt),
	]
)
