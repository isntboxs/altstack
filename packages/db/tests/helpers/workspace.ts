import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { fileURLToPath } from 'node:url'

import type { db } from '@altstack/db'
import {
	githubRepository,
	project,
	projectCategory,
} from '@altstack/db/schemas'
import { seedTaxonomy } from '@altstack/db/seed-taxonomy'

interface WorkspaceDatabase {
	db: typeof db
	migrationsSchema: string
	reset(): Promise<void>
}

const migrationsFolder = fileURLToPath(
	new URL('../../src/migrations', import.meta.url)
)

async function restoreTaxonomy(database: WorkspaceDatabase) {
	await database.reset()
	await migrate(database.db, {
		migrationsFolder,
		migrationsSchema: database.migrationsSchema,
	})
	await seedTaxonomy(database.db)
}

// The caller owns the connection. This also accepts a test schema so failure
// cleanup can be verified without disturbing concurrent API fixtures in public.
export async function withWorkspaceDatabase<T>(
	database: WorkspaceDatabase,
	work: () => Promise<T>
) {
	try {
		await restoreTaxonomy(database)
		const backend = await database.db.query.category.findFirst({
			where: { slug: 'backend' },
		})
		if (!backend) throw new Error('Missing backend test category')
		await database.db.transaction(async (tx) => {
			const [baseline] = await tx
				.insert(project)
				.values({
					name: 'Workspace baseline',
					slug: 'test-workspace-baseline',
					tagline: 'Synthetic baseline for existing API tests.',
					description:
						'Published backend fixture used only during workspace verification.',
					logo: 'test-fixtures/baseline.svg',
					repositoryUrl:
						'https://github.com/altstack-test-fixtures/workspace-baseline',
					status: 'published',
				})
				.returning({ id: project.id })
			if (!baseline) throw new Error('Missing workspace baseline project')
			await tx.insert(githubRepository).values({
				projectId: baseline.id,
				owner: 'altstack-test-fixtures',
				repo: 'workspace-baseline',
				fetchedAt: new Date(),
			})
			await tx
				.insert(projectCategory)
				.values({ projectId: baseline.id, categoryId: backend.id })
		})
		return await work()
	} finally {
		await restoreTaxonomy(database)
	}
}
