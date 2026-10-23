import { asc, count, desc, eq, sql, and, isNull } from 'drizzle-orm'

import type { db } from '@altstack/db'
import { githubRepository, project } from '@altstack/db/schemas'

// Unknown includes not-yet-refreshed, absent, and non-SPDX/custom detection.
export const publicLicenseSlug = sql<string>`coalesce(${githubRepository.licenseSlug}, 'unknown')`

export function projectHasLicense(slug: string) {
	return slug === 'unknown'
		? isNull(githubRepository.licenseSlug)
		: eq(githubRepository.licenseSlug, slug)
}

export async function listPublicLicenses(database: typeof db, slug?: string) {
	return database
		.select({
			slug: publicLicenseSlug,
			identifier: sql<string>`case when ${githubRepository.licenseSlug} is null then 'unknown' else min(${githubRepository.licenseSpdxId}) end`,
			name: sql<string>`case when ${githubRepository.licenseSlug} is null then 'unknown' else coalesce(min(${githubRepository.licenseName}), min(${githubRepository.licenseSpdxId})) end`,
			projectCount: count(),
		})
		.from(project)
		.innerJoin(githubRepository, eq(githubRepository.projectId, project.id))
		.where(
			and(
				eq(project.status, 'published'),
				slug ? projectHasLicense(slug) : undefined
			)
		)
		.groupBy(githubRepository.licenseSlug)
		.orderBy(desc(count()), asc(publicLicenseSlug))
}
