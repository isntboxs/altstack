import { desc, eq } from 'drizzle-orm'
import { RequestError } from 'octokit'

import { octokit } from '@altstack/api/github'
import { protectedProcedure } from '@altstack/api/procedures'

import { project, submission } from '@altstack/db/schemas'

import { canonicalizeGithubUrl } from '@altstack/shared/lib/github'

function hasPgCode(value: unknown, code: string): boolean {
	return (
		typeof value === 'object' &&
		value !== null &&
		'code' in value &&
		value.code === code
	)
}

// Drizzle wraps the pg driver error in `cause` (DrizzleQueryError),
// while in some paths the raw pg DatabaseError surfaces directly.
// Both carry the Postgres SQLSTATE code; 23505 = unique_violation.
function isUniqueViolation(error: unknown): boolean {
	if (hasPgCode(error, '23505')) return true

	if (
		typeof error === 'object' &&
		error !== null &&
		'cause' in error &&
		hasPgCode(error.cause, '23505')
	) {
		return true
	}

	return false
}

const createSubmissionHandler = protectedProcedure.submission.create.handler(
	async ({ context, errors, input }) => {
		const { auth, db } = context

		const { canonicalUrl, owner, repo } = canonicalizeGithubUrl(
			input.repositoryUrl
		)

		const [[existingProject], [existingSubmission]] = await Promise.all([
			db
				.select({ id: project.id })
				.from(project)
				.where(eq(project.repositoryUrl, canonicalUrl))
				.limit(1),
			db
				.select({ id: submission.id })
				.from(submission)
				.where(eq(submission.repositoryUrl, canonicalUrl))
				.limit(1),
		])

		if (existingProject || existingSubmission) throw errors.CONFLICT()

		try {
			await octokit.rest.repos.get({ owner, repo })
		} catch (error: unknown) {
			if (error instanceof RequestError) {
				if (error.status === 404) throw errors.NOT_FOUND()
				if (error.status === 403 || error.status === 429) {
					throw errors.TOO_MANY_REQUESTS()
				}
				throw errors.INTERNAL_SERVER_ERROR()
			}

			throw error
		}

		try {
			const [row] = await db
				.insert(submission)
				.values({
					submitterId: auth.user.id,
					name: input.name,
					repositoryUrl: canonicalUrl,
					websiteUrl: input.websiteUrl,
					status: 'pending',
				})
				.returning()

			if (!row) throw errors.INTERNAL_SERVER_ERROR()

			return {
				id: row.id,
				name: row.name,
				repositoryUrl: row.repositoryUrl,
				websiteUrl: row.websiteUrl,
				status: row.status,
				submittedAt: row.submittedAt,
			}
		} catch (error: unknown) {
			if (isUniqueViolation(error)) {
				throw errors.CONFLICT()
			}
			throw error
		}
	}
)

const listSubmissionsHandler = protectedProcedure.submission.list.handler(
	async ({ context }) => {
		const { db, auth } = context

		const rows = db
			.select()
			.from(submission)
			.where(eq(submission.submitterId, auth.user.id))
			.orderBy(desc(submission.submittedAt))

		return rows
	}
)

export const submissionRouter = {
	create: createSubmissionHandler,
	list: listSubmissionsHandler,
}
