import { eq, inArray } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import type { db } from '@altstack/db'
import {
	category,
	githubRepository,
	project,
	projectCategory,
} from '@altstack/db/schemas'
import { seedTaxonomy } from '@altstack/db/seed-taxonomy'

import type { ProjectStatus } from '@altstack/shared/constants'

// Test-only data. Call with an isolated DB; dispose owns only the Zed project.
// The surrounding isolated test schema owns the taxonomy lifecycle.
export async function createZedFixture(
	database: typeof db,
	status: ProjectStatus = 'draft'
) {
	await seedTaxonomy(database)
	const suffix = randomUUID()
	const slugs = ['general-purpose-editors', 'ai-powered-editors']
	const leaves = await database
		.select()
		.from(category)
		.where(inArray(category.slug, slugs))
	if (leaves.length !== 2) {
		throw new Error('Expected both editor leaf categories')
	}
	const projectId = await database.transaction(async (tx) => {
		const [zed] = await tx
			.insert(project)
			.values({
				name: 'Zed',
				slug: `test-zed-${suffix}`,
				tagline: 'A code editor for people and AI.',
				description:
					'Synthetic Zed fixture assigned directly to two sibling editor leaves.',
				logo: 'test-fixtures/zed.svg',
				repositoryUrl: `https://github.com/altstack-test-fixtures/zed-${suffix}`,
				status,
			})
			.returning({ id: project.id })
		if (!zed) throw new Error('Failed to insert Zed fixture')
		await tx.insert(githubRepository).values({
			projectId: zed.id,
			owner: 'altstack-test-fixtures',
			repo: `zed-${suffix}`,
			stars: 123,
			forks: 12,
			fetchedAt: new Date('2026-10-01T00:00:00Z'),
		})
		await tx.insert(projectCategory).values(
			leaves.map((leaf) => {
				return {
					projectId: zed.id,
					categoryId: leaf.id,
				}
			})
		)
		return zed.id
	})
	return {
		projectId,
		leaves,
		async dispose() {
			await database.delete(project).where(eq(project.id, projectId))
		},
	}
}
