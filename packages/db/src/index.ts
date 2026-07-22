import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import { env } from '@altstack/env/server'

export function createDb() {
	const pool = new Pool({
		connectionString: env.DATABASE_URL,
	})

	return drizzle({ client: pool })
}

export const db = createDb()
