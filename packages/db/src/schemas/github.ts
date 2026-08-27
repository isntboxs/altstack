import { sql } from 'drizzle-orm'
import {
	pgTable,
	text,
	timestamp,
	uuid,
	index,
	integer,
} from 'drizzle-orm/pg-core'

import { project } from '@altstack/db/schemas/project'

export const githubRepo = pgTable(
	'github_repos',
	{
		id: uuid('id')
			.default(sql`pg_catalog.gen_random_uuid()`)
			.primaryKey(),
		projectId: uuid('project_id')
			.notNull()
			.unique()
			.references(() => project.id, { onDelete: 'cascade' }),
		owner: text('owner').notNull(),
		repo: text('repo').notNull(),
		stars: integer('stars').notNull().default(0),
		forks: integer('forks').notNull().default(0),
		createdAt: timestamp('created_at').notNull().defaultNow(),
		updatedAt: timestamp('updated_at')
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index('github_repo_owner_repo_idx').on(table.owner, table.repo),
		index('github_repo_project_idx').on(table.projectId),
	]
)
