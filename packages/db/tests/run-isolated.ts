import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import {
	githubRepository,
	project,
	projectCategory,
} from '@altstack/db/schemas'
import { seedTaxonomy } from '@altstack/db/seed-taxonomy'

import { startTestPostgres } from './helpers/postgres'

// Existing API tests use DATABASE_URL and expect a published backend project.
// Supply only synthetic baseline data and credentials on a disposable server.
const postgres = await startTestPostgres()
try {
	const database = await postgres.createDatabase()
	await migrate(database.db, {
		migrationsFolder: fileURLToPath(
			new URL('../src/migrations', import.meta.url)
		),
	})
	await seedTaxonomy(database.db)
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
					'Published backend fixture used only in this disposable database.',
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
	const args = process.argv
		.slice(2)
		.filter((arg, index) => index !== 0 || arg !== '--')
	const [command, ...commandArgs] =
		args.length > 0 ? args : ['vp', 'run', 'ready']
	if (!command) throw new Error('Missing verification command')
	const exitCode = await new Promise<number>((resolve, reject) => {
		const child = spawn(command, commandArgs, {
			cwd: fileURLToPath(new URL('../../../', import.meta.url)),
			stdio: 'inherit',
			env: {
				...process.env,
				NODE_ENV: 'test',
				PORT: '3001',
				DATABASE_URL: database.url,
				APP_NAME: 'Altstack Test',
				BETTER_AUTH_URL: 'http://localhost:3001',
				BETTER_AUTH_SECRET: 'altstack-test-only-secret-00000000',
				CORS_ORIGINS: 'http://localhost:3000',
				GITHUB_CLIENT_ID: 'test-only',
				GITHUB_CLIENT_SECRET: 'altstack-test-only-secret-00000000',
				GITHUB_TOKEN: 'altstack-test-only-token-000000000',
				S3_ENDPOINT: 'https://storage.test',
				S3_REGION: 'test',
				S3_BUCKET: 'test',
				S3_ACCESS_KEY_ID: 'test-only',
				S3_SECRET_ACCESS_KEY: 'altstack-test-only-secret-00000000',
				S3_PUBLIC_URL: 'https://storage.test',
			},
		})
		child.once('error', reject)
		child.once('exit', (code) => resolve(code ?? 1))
	})
	process.exitCode = exitCode
} finally {
	await postgres.close()
}
