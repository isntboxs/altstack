import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'

import { findReservedProjectSlugs } from '@altstack/db/project-slug-preflight'

dotenv.config({
	path: fileURLToPath(new URL('../../../.env', import.meta.url)),
	quiet: true,
})

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not defined')

const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
	connectionTimeoutMillis: 10000,
})
try {
	const collisions = await findReservedProjectSlugs(pool)
	if (collisions.length > 0) {
		process.stderr.write(
			`Reserved project slugs block rollout:\n${collisions.map((row) => `- ${row.id}: /${row.slug} (${row.status})`).join('\n')}\nRename these projects to unused, non-reserved slugs and rerun this check. See docs/deployment.md#reserved-project-slugs. No data was changed.\n`
		)
		process.exitCode = 1
	} else {
		process.stdout.write('No reserved project-slug collisions found.\n')
	}
} finally {
	await pool.end()
}
