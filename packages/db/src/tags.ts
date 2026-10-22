import { eq, inArray, sql } from 'drizzle-orm'

import type { db } from '@altstack/db'
import { projectTag, tag } from '@altstack/db/schemas'

import { githubTopicsSchema } from '@altstack/shared/schemas/tag'

type TagTransaction = Pick<
	typeof db,
	'select' | 'insert' | 'delete' | 'execute'
>

export async function lockTagIntegrity(tx: Pick<typeof db, 'execute'>) {
	await tx.execute(
		sql`SELECT pg_advisory_xact_lock(hashtext('altstack.tags'), hashtext(current_schema()))`
	)
}

// Call inside the transaction that stores the verified GitHub repository.
// Unknown/failed metadata must not be passed as an empty successful snapshot.
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
