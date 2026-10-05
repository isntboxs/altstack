import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { fileURLToPath } from 'node:url'
import type { Pool } from 'pg'

import type { db } from '@altstack/db'
import {
	githubRepository,
	project,
	projectCategory,
} from '@altstack/db/schemas'
import { seedTaxonomy } from '@altstack/db/seed-taxonomy'

interface WorkspaceDatabase {
	db: typeof db
	pool: Pool
	migrationsSchema: string
	reset(): Promise<void>
}

const WORKSPACE_LOCK_NAMESPACE = 'altstack.workspace-verification'

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
	// Public verification shares a lock; isolated test schemas remain independent.
	const lockClient = await database.pool.connect()
	const lockKeys = [WORKSPACE_LOCK_NAMESPACE, database.migrationsSchema]
	try {
		const result = await lockClient.query<{ locked: boolean }>(
			'SELECT pg_try_advisory_lock(hashtext($1), hashtext($2)) AS locked',
			lockKeys
		)
		if (result.rows[0]?.locked !== true) {
			throw new Error(
				'Another workspace verification is using this database schema'
			)
		}
	} catch (error) {
		lockClient.release(true)
		throw error
	}
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
		try {
			await restoreTaxonomy(database)
		} finally {
			try {
				await lockClient.query(
					'SELECT pg_advisory_unlock(hashtext($1), hashtext($2))',
					lockKeys
				)
			} finally {
				// Close this dedicated session even when acquiring or releasing fails.
				lockClient.release(true)
			}
		}
	}
}
