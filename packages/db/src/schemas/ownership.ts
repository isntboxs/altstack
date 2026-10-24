import { sql } from 'drizzle-orm'
import {
	check,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from 'drizzle-orm/pg-core'

import { user } from '@altstack/db/schemas/auth'
import { project } from '@altstack/db/schemas/project'

import type { ClaimGithubEvidence } from '@altstack/shared/schemas/ownership'

export const projectClaim = pgTable(
	'project_claims',
	{
		id: uuid('id')
			.default(sql`pg_catalog.gen_random_uuid()`)
			.primaryKey(),
		projectId: uuid('project_id')
			.notNull()
			.references(() => project.id, { onDelete: 'cascade' }),
		userId: uuid('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		email: text('email').notNull(),
		role: text('role').$type<'owner' | 'maintainer'>().notNull(),
		status: text('status')
			.$type<'email_pending' | 'pending' | 'approved' | 'rejected'>()
			.notNull(),
		challengeId: uuid('challenge_id').notNull(),
		codeHash: text('code_hash'),
		codeExpiresAt: timestamp('code_expires_at').notNull(),
		attempts: integer('attempts').default(0).notNull(),
		sentAt: timestamp('sent_at'),
		requestedAt: timestamp('requested_at').defaultNow().notNull(),
		emailVerifiedAt: timestamp('email_verified_at'),
		githubEvidence: jsonb('github_evidence').$type<ClaimGithubEvidence>(),
		reviewerId: uuid('reviewer_id').references(() => user.id, {
			onDelete: 'set null',
		}),
		reviewedAt: timestamp('reviewed_at'),
	},
	(table) => [
		uniqueIndex('project_claims_project_user_idx').on(
			table.projectId,
			table.userId
		),
		index('project_claims_status_requested_idx').on(
			table.status,
			table.requestedAt
		),
		index('project_claims_user_idx').on(table.userId),
		check(
			'project_claims_role_check',
			sql`${table.role} IN ('owner', 'maintainer')`
		),
		check(
			'project_claims_status_check',
			sql`${table.status} IN ('email_pending', 'pending', 'approved', 'rejected')`
		),
		check(
			'project_claims_attempts_check',
			sql`${table.attempts} BETWEEN 0 AND 5`
		),
	]
)

// Submission provenance stays in projects.submitter_id. Membership is granted
// only by an eligible, different reviewer after email proof.
export const projectMember = pgTable(
	'project_members',
	{
		projectId: uuid('project_id')
			.notNull()
			.references(() => project.id, { onDelete: 'cascade' }),
		userId: uuid('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		role: text('role').$type<'owner' | 'maintainer'>().notNull(),
		approvedBy: uuid('approved_by').references(() => user.id, {
			onDelete: 'set null',
		}),
		createdAt: timestamp('created_at').defaultNow().notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.projectId, table.userId] }),
		index('project_members_user_idx').on(table.userId),
		check(
			'project_members_role_check',
			sql`${table.role} IN ('owner', 'maintainer')`
		),
	]
)

// A member may only consume/delete temporary uploads issued for their own
// account and this project. Legacy admin uploads retain their existing API.
export const projectUpload = pgTable(
	'project_uploads',
	{
		key: text('key').primaryKey(),
		projectId: uuid('project_id')
			.notNull()
			.references(() => project.id, { onDelete: 'cascade' }),
		userId: uuid('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		createdAt: timestamp('created_at').defaultNow().notNull(),
	},
	(table) => [
		index('project_uploads_project_user_idx').on(table.projectId, table.userId),
	]
)
