import { eq, inArray, sql } from 'drizzle-orm'

import type { db } from '@altstack/db'
import { projectTag, tag } from '@altstack/db/schemas'

import { githubTopicsSchema } from '@altstack/shared/schemas/tag'

type TagTransaction = Pick<
	typeof db,
	'select' | 'insert' | 'delete' | 'execute'
>

/** Serializes tag assignment and deletion within the current schema's transaction. */
export async function lockTagIntegrity(tx: Pick<typeof db, 'execute'>) {
	await tx.execute(
		sql`SELECT pg_advisory_xact_lock(hashtext('altstack.tags'), hashtext(current_schema()))`
	)
}

/**
 * Replaces a project's topics while preserving shared tags and admin curation.
 * Call in the repository transaction only after a successful metadata fetch;
 * an empty snapshot removes assignments, so failed fetches must skip this call.
 */
export async function syncProjectTags(
	tx: TagTransaction,
	projectId: string,
	topics: Array<string>
) {
	const slugs = [...new Set(githubTopicsSchema.parse(topics))].toSorted()
	await lockTagIntegrity(tx)
	if (slugs.length > 0) {
		await tx
			.insert(tag)
			.values(
				slugs.map((slug) => {
					return { slug, name: slug }
				})
			)
			.onConflictDoNothing({ target: tag.slug })
	}
	await tx.delete(projectTag).where(eq(projectTag.projectId, projectId))
	if (slugs.length === 0) return
	const rows = await tx
		.select({ id: tag.id })
		.from(tag)
		.where(inArray(tag.slug, slugs))
	await tx.insert(projectTag).values(
		rows.map((row) => {
			return { projectId, tagId: row.id }
		})
	)
}
