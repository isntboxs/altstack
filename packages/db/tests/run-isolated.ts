import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { connectTestPostgres } from './helpers/postgres'
import { withWorkspaceDatabase } from './helpers/workspace'

// This command resets altstack_development before and after verification.
// Only the migration chain and taxonomy seed remain after fixture cleanup.
const database = await connectTestPostgres()
try {
	process.exitCode = await withWorkspaceDatabase(database, async () => {
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
		return exitCode
	})
} finally {
	await database.close()
}
