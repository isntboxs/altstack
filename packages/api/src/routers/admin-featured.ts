import { asc, eq, inArray, sql } from 'drizzle-orm'

import { adminProcedure } from '@altstack/api/procedures'

import {
	featuredProject,
	githubRepository,
	project,
} from '@altstack/db/schemas'

import { featuredWebsiteUrl } from '@altstack/shared/schemas/featured'

const selection = {
	id: project.id,
	name: project.name,
	slug: project.slug,
	logo: project.logo,
	tagline: project.tagline,
	websiteUrl: project.websiteUrl,
	status: project.status,
}

export const adminFeaturedRouter = {
	list: adminProcedure.admin.featured.list.handler(
		async ({ context: { db } }) => {
			return {
				projects: await db
					.select(selection)
					.from(featuredProject)
					.innerJoin(project, eq(project.id, featuredProject.projectId))
					.orderBy(asc(featuredProject.position)),
			}
		}
	),
	update: adminProcedure.admin.featured.update.handler(
		async ({ context: { db }, input, errors }) => {
			const { projectIds, expectedProjectIds } = input.body
			return db.transaction(async (tx) => {
				// Serialize all whole-list writes, including two saves of an empty list.
				await tx.execute(
					sql`SELECT pg_advisory_xact_lock(hashtext('altstack:featured-projects'))`
				)
				const current = await tx
					.select({ id: featuredProject.projectId })
					.from(featuredProject)
					.orderBy(asc(featuredProject.position))
				if (
					JSON.stringify(current.map(({ id }) => id)) !==
					JSON.stringify(expectedProjectIds)
				) {
					throw errors.CONFLICT({
						message:
							'Featured projects changed. Reload the selection before saving.',
					})
				}
				const rows =
					projectIds.length > 0
						? await tx
								.select(selection)
								.from(project)
								.innerJoin(
									githubRepository,
									eq(githubRepository.projectId, project.id)
								)
								.where(inArray(project.id, projectIds))
								.for('update', { of: project })
						: []
				if (
					rows.length !== projectIds.length ||
					rows.some(
						(row) =>
							row.status !== 'published' || !featuredWebsiteUrl(row.websiteUrl)
					)
				) {
					throw errors.BAD_REQUEST({
						message:
							'Choose published projects with a valid website. Remove any unavailable projects before saving.',
					})
				}
				await tx.delete(featuredProject)
				if (projectIds.length > 0) {
					await tx.insert(featuredProject).values(
						projectIds.map((projectId, position) => {
							return { projectId, position }
						})
					)
				}
				return {
					projects: projectIds.map((id) => rows.find((row) => row.id === id)!),
				}
			})
		}
	),
}
