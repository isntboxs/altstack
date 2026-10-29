import type { Pool } from 'pg'

import { RESERVED_PROJECT_SLUGS } from '@altstack/shared/constants'

/** Finds legacy route collisions without changing data; an unmigrated database is empty. */
export async function findReservedProjectSlugs(pool: Pick<Pool, 'query'>) {
	const relation = await pool.query<{ name: string | null }>(
		"SELECT to_regclass('projects')::text AS name"
	)
	if (relation.rows[0]?.name === null) return []
	const result = await pool.query<{
		id: string
		slug: string
		status: string
	}>(
		'SELECT id, slug, status FROM projects WHERE slug = ANY($1::text[]) ORDER BY slug',
		[[...RESERVED_PROJECT_SLUGS]]
	)
	return result.rows
}
