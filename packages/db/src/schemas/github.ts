import { sql } from 'drizzle-orm'
import {
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
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
		owner: text('owner').notNull(),
		repo: text('repo').notNull(),
		stars: integer('stars').notNull().default(0),
		forks: integer('forks').notNull().default(0),
		fetchedAt: timestamp('fetched_at').notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex('github_repo_owner_repo_idx').on(table.owner, table.repo),
		index('github_repo_project_idx').on(table.projectId),
	]
)
