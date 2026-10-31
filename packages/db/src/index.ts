import { drizzle } from 'drizzle-orm/node-postgres'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import { relations } from '@altstack/db/relations'

import { env } from '@altstack/env/server'

export type Database = NodePgDatabase<typeof relations> & { $client: Pool }

export function createDb(): Database {
	const pool = new Pool({
		connectionString: env.DATABASE_URL,
	})

	return drizzle({ client: pool, relations })
}

export const db = createDb()
