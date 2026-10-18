import { and, eq, inArray } from 'drizzle-orm'

import { db } from '@altstack/db'
import { githubRepository, project } from '@altstack/db/schemas'

// Match the public detail endpoint, including its required repository row.
export async function publicProjectMentions(
	slugs: Array<string>,
	database: Pick<typeof db, 'select'> = db
) {
	if (slugs.length === 0) return []
	return database
		.select({ slug: project.slug, name: project.name, logo: project.logo })
		.from(project)
		.innerJoin(githubRepository, eq(project.id, githubRepository.projectId))
		.where(
			and(
				eq(project.status, 'published'),
				inArray(project.slug, [...new Set(slugs)])
			)
		)
}
