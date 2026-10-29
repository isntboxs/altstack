import { and, asc, count, eq } from 'drizzle-orm'

import { db } from '@altstack/db'
import { githubRepository, project } from '@altstack/db/schemas'

import { getPublicCategoryById, listPublicCategories } from './category'
import { listPublicLicenses } from './license'

// Match public detail/list visibility, including its required repository row.
// Select public fields explicitly; never serialize the underlying project row.
const published = eq(project.status, 'published')
const fields = {
	id: project.id,
	slug: project.slug,
	name: project.name,
	tagline: project.tagline,
	description: project.description,
	updatedAt: project.updatedAt,
}
export const sitemapPageSize = 1000

export async function publicBadgeProject(slug: string) {
	const rows = await db
		.select({ name: project.name })
		.from(project)
		.innerJoin(githubRepository, eq(project.id, githubRepository.projectId))
		.where(and(published, eq(project.slug, slug)))
		.limit(1)
	return rows.at(0)
}

export async function publicOgProject(id: string) {
	const rows = await db
		.select({
			...fields,
			logo: project.logo,
			github: {
				owner: githubRepository.owner,
				repo: githubRepository.repo,
				stars: githubRepository.stars,
				forks: githubRepository.forks,
				fetchedAt: githubRepository.fetchedAt,
			},
		})
		.from(project)
		.innerJoin(githubRepository, eq(project.id, githubRepository.projectId))
		.where(and(published, eq(project.id, id)))
		.limit(1)
	return rows.at(0)
}

export async function publicOgCategory(id: string) {
	return getPublicCategoryById(db, id)
}

export async function sitemapProjectCount() {
	const [row] = await db
		.select({ total: count() })
		.from(project)
		.innerJoin(githubRepository, eq(project.id, githubRepository.projectId))
		.where(published)
	return row?.total ?? 0
}

export async function sitemapProjects(page: number) {
	return db
		.select({ slug: project.slug, updatedAt: project.updatedAt })
		.from(project)
		.innerJoin(githubRepository, eq(project.id, githubRepository.projectId))
		.where(published)
		.orderBy(asc(project.id))
		.limit(sitemapPageSize)
		.offset((page - 1) * sitemapPageSize)
}

export async function sitemapCategories() {
	return listPublicCategories(db)
}

export async function sitemapLicenses() {
	return listPublicLicenses(db)
}

export async function sitemapCollections() {
	const { sitemapCollections: list } = await import('./collection')
	return list(db)
}
