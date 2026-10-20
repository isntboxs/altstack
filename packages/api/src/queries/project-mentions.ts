import { and, asc, desc, eq, ilike, inArray, or } from 'drizzle-orm'

import { db } from '@altstack/db'
import { githubRepository, project } from '@altstack/db/schemas'

export async function publicProjectContent(
	slug: string,
	database: Pick<typeof db, 'select'> = db
) {
	const rows = await database
		.select({ content: project.content })
		.from(project)
		.innerJoin(githubRepository, eq(project.id, githubRepository.projectId))
		.where(and(eq(project.status, 'published'), eq(project.slug, slug)))
		.limit(1)
	return rows.at(0)
}

// Match the public detail endpoint, including its required repository row.
export async function publicProjectMentions(
	slugs: Array<string>,
	database: Pick<typeof db, 'select'> = db
) {
	if (slugs.length === 0) return []
	return database
		.select({
			slug: project.slug,
			name: project.name,
			logo: project.logo,
			tagline: project.tagline,
			stars: githubRepository.stars,
			forks: githubRepository.forks,
		})
		.from(project)
		.innerJoin(githubRepository, eq(project.id, githubRepository.projectId))
		.where(
			and(
				eq(project.status, 'published'),
				inArray(project.slug, [...new Set(slugs)])
			)
		)
}

// Autocomplete needs partial names/slugs rather than full-text word matching.
export async function searchPublicProjectMentions(
	query: string,
	database: Pick<typeof db, 'select'> = db
) {
	const term = query.trim()
	const pattern = `%${term.replace(/[\\%_]/g, '\\$&')}%`
	return database
		.select({
			slug: project.slug,
			name: project.name,
			logo: project.logo,
			tagline: project.tagline,
		})
		.from(project)
		.innerJoin(githubRepository, eq(project.id, githubRepository.projectId))
		.where(
			and(
				eq(project.status, 'published'),
				term
					? or(ilike(project.name, pattern), ilike(project.slug, pattern))
					: undefined
			)
		)
		.orderBy(desc(githubRepository.stars), asc(project.name), asc(project.slug))
		.limit(8)
}
