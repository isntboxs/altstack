import { runGithubRefreshBatch } from '@altstack/api/github-refresh-batch'

import { db } from '@altstack/db'

import { env } from '@altstack/env/server'

async function main() {
	try {
		if (!env.GITHUB_TOKEN) {
			throw new Error('GITHUB_TOKEN is required for the refresh job')
		}
		const summary = await runGithubRefreshBatch(db, {
			log: (event) => process.stdout.write(`${JSON.stringify(event)}\n`),
		})
		if (summary.failed > 0) process.exitCode = 1
	} catch (error) {
		process.stderr.write(
			`${JSON.stringify({
				event: 'github-refresh-fatal',
				message: error instanceof Error ? error.message : 'Unexpected failure',
			})}\n`
		)
		process.exitCode = 1
	} finally {
		await db.$client.end()
	}
}

if (import.meta.main) await main()
