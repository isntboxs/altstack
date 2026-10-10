import { ORPCError } from '@orpc/server'
import { and, eq, inArray, ne, sql } from 'drizzle-orm'

import { fetchPublicGithubStatistics } from '@altstack/api/github'
import { isUniqueViolation } from '@altstack/api/queries/pg-error'

import type { db } from '@altstack/db'
import { githubRepository, project } from '@altstack/db/schemas'
import { canonicalRepositoryKey } from '@altstack/db/schemas/project'

export const emptyGithubMetadata = {
	lastCommitAt: null,
	repositoryCreatedAt: null,
	latestReleaseTag: null,
	metadataFetchedAt: null,
}

export function githubDetail(row: typeof githubRepository.$inferSelect) {
	return {
		owner: row.owner,
		repo: row.repo,
		stars: row.stars,
		forks: row.forks,
		fetchedAt: row.fetchedAt,
		lastCommitAt: row.lastCommitAt,
		repositoryCreatedAt: row.repositoryCreatedAt,
		latestReleaseTag: row.latestReleaseTag,
		metadataFetchedAt: row.metadataFetchedAt,
	}
}

export async function refreshProjectGithub(
	database: typeof db,
	id: string,
	expectedRepositoryUrl?: string
) {
	const [snapshot] = await database
		.select({
			repositoryUrl: project.repositoryUrl,
			owner: githubRepository.owner,
			repo: githubRepository.repo,
			revision: sql<string>`${githubRepository}.xmin::text`,
		})
		.from(project)
		.innerJoin(githubRepository, eq(githubRepository.projectId, project.id))
		.where(eq(project.id, id))
		.limit(1)
	if (!snapshot) throw new ORPCError('NOT_FOUND')
	const changed = () =>
		new ORPCError('CONFLICT', {
			message: 'The repository changed during refresh. Please retry.',
		})
	if (
		expectedRepositoryUrl !== undefined &&
		expectedRepositoryUrl !== snapshot.repositoryUrl
	) {
		throw changed()
	}
	// No transaction/row locks across external network calls.
	const fetched = await fetchPublicGithubStatistics(
		snapshot.owner,
		snapshot.repo
	)
	const fetchedAt = new Date()
	try {
		return await database.transaction(async (tx) => {
			// Use the same lock order as admin updates. The github row revision
			// also protects A → B → A changes and concurrent refresh completion.
			const [currentProject] = await tx
				.select({ repositoryUrl: project.repositoryUrl })
				.from(project)
				.where(eq(project.id, id))
				.limit(1)
				.for('update')
			if (!currentProject) throw new ORPCError('NOT_FOUND')
			const [currentGithub] = await tx
				.select({ revision: sql<string>`xmin::text` })
				.from(githubRepository)
				.where(eq(githubRepository.projectId, id))
				.limit(1)
				.for('update')
			if (
				currentProject.repositoryUrl !== snapshot.repositoryUrl ||
				currentGithub?.revision !== snapshot.revision
			) {
				throw changed()
			}
			const [other] = await tx
				.select({ id: project.id })
				.from(project)
				.where(
					and(
						ne(project.id, id),
						inArray(canonicalRepositoryKey(project.repositoryUrl), [
							snapshot.repositoryUrl,
							fetched.canonicalUrl,
						])
					)
				)
				.limit(1)
			if (other) throw new ORPCError('CONFLICT')
			if (fetched.canonicalUrl !== snapshot.repositoryUrl) {
				await tx
					.update(project)
					.set({ repositoryUrl: fetched.canonicalUrl })
					.where(eq(project.id, id))
			}
			const [stored] = await tx
				.update(githubRepository)
				.set({
					owner: fetched.owner,
					repo: fetched.repo,
					stars: fetched.stars,
					forks: fetched.forks,
					lastCommitAt: fetched.lastCommitAt,
					repositoryCreatedAt: fetched.repositoryCreatedAt,
					latestReleaseTag: fetched.latestReleaseTag,
					fetchedAt,
					metadataFetchedAt: fetchedAt,
				})
				.where(eq(githubRepository.projectId, id))
				.returning()
			if (!stored) throw new ORPCError('NOT_FOUND')
			return {
				repositoryUrl: fetched.canonicalUrl,
				github: githubDetail(stored),
			}
		})
	} catch (error) {
		if (isUniqueViolation(error)) throw new ORPCError('CONFLICT')
		throw error
	}
}

// Primary create/approval/update has already committed. Enrichment is optional.
export async function enrichProjectGithubBestEffort(
	database: typeof db,
	id: string,
	repositoryUrl: string
) {
	try {
		return await refreshProjectGithub(database, id, repositoryUrl)
	} catch {
		return null
	}
}
