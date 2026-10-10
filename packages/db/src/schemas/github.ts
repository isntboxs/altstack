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
		projectId: uuid('project_id')
			.primaryKey()
			.references(() => project.id, { onDelete: 'cascade' }),
		owner: text('owner').notNull(),
		repo: text('repo').notNull(),
		stars: integer('stars').notNull().default(0),
		forks: integer('forks').notNull().default(0),
		fetchedAt: timestamp('fetched_at').notNull(),
		lastCommitAt: timestamp('last_commit_at', { withTimezone: true }),
		repositoryCreatedAt: timestamp('repository_created_at', {
			withTimezone: true,
		}),
		latestReleaseTag: text('latest_release_tag'),
		metadataFetchedAt: timestamp('metadata_fetched_at', { withTimezone: true }),
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
