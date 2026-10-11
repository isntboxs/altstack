import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { connectTestPostgres } from './helpers/postgres'
import { withWorkspaceDatabase } from './helpers/workspace'

// Verification owns a disposable schema and never resets public development data.
const database = await connectTestPostgres()
try {
	const scope = await database.createSchema()
	try {
		process.exitCode = await withWorkspaceDatabase(scope, async () => {
			const args = process.argv
				.slice(2)
				.filter((arg, index) => index !== 0 || arg !== '--')
			const [command, ...commandArgs] =
				args.length > 0 ? args : ['vp', 'run', '-r', 'test']
			if (!command) throw new Error('Missing verification command')
			return new Promise<number>((resolve, reject) => {
				const child = spawn(command, commandArgs, {
					cwd: fileURLToPath(new URL('../../../', import.meta.url)),
					stdio: 'inherit',
					env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: scope.url },
				})
				child.once('error', reject)
				child.once('exit', (code) => resolve(code ?? 1))
			})
		})
	} finally {
		await scope.close()
	}
} finally {
	await database.close()
}
