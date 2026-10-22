import { eq } from 'drizzle-orm'

import { adminProcedure, publicProcedure } from '@altstack/api/procedures'
import { isUniqueViolation } from '@altstack/api/queries/pg-error'
import { getPublicTag, listTags } from '@altstack/api/queries/tag'

import { projectTag, tag } from '@altstack/db/schemas'
import { lockTagIntegrity } from '@altstack/db/tags'

export const tagRouter = {
	list: publicProcedure.tag.list.handler(async ({ context, input }) => {
		const result = await listTags(context.db, input.query)
		return {
			pagination: result.pagination,
			tags: result.tags.map(({ id, slug, name, description, projectCount }) => {
				return { id, slug, name, description, projectCount }
			}),
		}
	}),
	getBySlug: publicProcedure.tag.getBySlug.handler(
		async ({ context, input, errors }) => {
			const found = await getPublicTag(context.db, input.params.slug)
			if (!found) throw errors.NOT_FOUND()
			return { tag: found }
		}
	),
}
export const adminTagRouter = {
	list: adminProcedure.admin.tag.list.handler(({ context, input }) =>
		listTags(context.db, input.query, true)
	),
	create: adminProcedure.admin.tag.create.handler(
		async ({ context, input, errors }) => {
			try {
				const [created] = await context.db
					.insert(tag)
					.values(input.body)
					.returning()
				if (!created) throw errors.INTERNAL_SERVER_ERROR()
				return created
			} catch (error) {
				if (isUniqueViolation(error)) {
					throw errors.CONFLICT({
						message: 'This GitHub topic already exists.',
					})
				}
				throw error
			}
		}
	),
	update: adminProcedure.admin.tag.update.handler(
		async ({ context, input, errors }) => {
			if (
				input.body.name === undefined &&
				input.body.description === undefined &&
				input.body.hidden === undefined
			) {
				const [current] = await context.db
					.select()
					.from(tag)
					.where(eq(tag.id, input.params.id))
				if (!current) throw errors.NOT_FOUND()
				return current
			}
			const [updated] = await context.db
				.update(tag)
				.set(input.body)
				.where(eq(tag.id, input.params.id))
				.returning()
			if (!updated) throw errors.NOT_FOUND()
			return updated
		}
	),
	remove: adminProcedure.admin.tag.remove.handler(
		({ context, input, errors }) =>
			context.db.transaction(async (tx) => {
				await lockTagIntegrity(tx)
				const [used] = await tx
					.select({ id: projectTag.projectId })
					.from(projectTag)
					.where(eq(projectTag.tagId, input.params.id))
					.limit(1)
				if (used) {
					throw errors.CONFLICT({
						message: 'This tag is assigned to projects. Hide it instead.',
					})
				}
				const [deleted] = await tx
					.delete(tag)
					.where(eq(tag.id, input.params.id))
					.returning({ id: tag.id })
				if (!deleted) throw errors.NOT_FOUND()
				return { success: true as const }
			})
	),
}
