import { and, count, desc, eq, ilike } from 'drizzle-orm'

import { fetchPublicGithubRepository } from '@altstack/api/github'
import { protectedProcedure } from '@altstack/api/procedures'
import { isUniqueViolation } from '@altstack/api/queries/pg-error'

import { auditLog, githubRepository, project } from '@altstack/db/schemas'
import { canonicalRepositoryKey } from '@altstack/db/schemas/project'

import { canonicalizeGithubUrl } from '@altstack/shared/lib/github'
import { slugify } from '@altstack/shared/lib/slug'

export const submissionRouter = {
	list: protectedProcedure.submission.list.handler(
		async ({ context: { db, auth }, input: { query } }) => {
			// Ownership is always derived from the authenticated session, for both
			// rows and counts. Query parameters cannot select another submitter.
			const where = and(
				eq(project.submitterId, auth.user.id),
				query.q
					? ilike(project.name, `%${query.q.replace(/[\\%_]/g, '\\$&')}%`)
					: undefined
			)
			const [submissions, [total]] = await Promise.all([
				db
					.select({
						id: project.id,
						name: project.name,
						slug: project.slug,
						logo: project.logo,
						repositoryUrl: project.repositoryUrl,
						status: project.status,
						rejectionReason: project.rejectionReason,
						createdAt: project.createdAt,
					})
					.from(project)
					.where(where)
					.orderBy(desc(project.createdAt), desc(project.id))
					.limit(query.limit)
					.offset((query.page - 1) * query.limit),
				db.select({ count: count() }).from(project).where(where),
			])
			const totalItems = total?.count ?? 0
			const totalPages = Math.ceil(totalItems / query.limit)
			return {
				submissions,
				pagination: {
					page: query.page,
					limit: query.limit,
					totalItems,
					totalPages,
					hasNextPage: query.page < totalPages,
					hasPreviousPage: query.page > 1,
				},
			}
		}
	),
	create: protectedProcedure.submission.create.handler(
		async ({ context: { db, auth }, input, errors }) => {
			const { canonicalUrl, owner, repo } = canonicalizeGithubUrl(
				input.repositoryUrl
			)
			const [existing] = await db
				.select({ id: project.id })
				.from(project)
				.where(eq(canonicalRepositoryKey(project.repositoryUrl), canonicalUrl))
				.limit(1)
			if (existing) {
				throw errors.CONFLICT({
					message: 'This repository has already been submitted or listed.',
				})
			}

			// Quality guidelines are reviewed by an admin; stars are never a gate.
			const metadata = await fetchPublicGithubRepository(owner, repo)
			const baseSlug =
				slugify(input.name).slice(0, 90).replace(/-+$/, '') || 'project'
			try {
				return await db.transaction(async (tx) => {
					// ON CONFLICT only targets the slug. Repository uniqueness still raises
					// 23505, including concurrent submissions, and rolls back everything.
					let inserted: typeof project.$inferSelect | undefined
					let suffix = 1
					while (!inserted) {
						const slug = suffix === 1 ? baseSlug : `${baseSlug}-${suffix}`
						;[inserted] = await tx
							.insert(project)
							.values({
								name: input.name,
								slug,
								repositoryUrl: canonicalUrl,
								websiteUrl: input.websiteUrl ?? null,
								status: 'draft',
								submitterId: auth.user.id,
							})
							.onConflictDoNothing({ target: project.slug })
							.returning()
						suffix += 1
					}
					await tx.insert(githubRepository).values({
						projectId: inserted.id,
						owner,
						repo,
						...metadata,
						fetchedAt: new Date(),
					})
					await tx.insert(auditLog).values({
						actorId: auth.user.id,
						projectId: inserted.id,
						action: 'project_submitted',
					})
					return { id: inserted.id, status: 'draft' as const }
				})
			} catch (error) {
				if (isUniqueViolation(error)) {
					throw errors.CONFLICT({
						message: 'This repository has already been submitted or listed.',
					})
				}
				throw errors.INTERNAL_SERVER_ERROR({
					message: 'Unable to save your submission. Please try again.',
				})
			}
		}
	),
}
