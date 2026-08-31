import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import { authRelations } from '@altstack/db/relations'

import { env } from '@altstack/env/server'

export function createDb() {
	const pool = new Pool({
		connectionString: env.DATABASE_URL,
	})

	return drizzle({
		client: pool,
		relations: { ...authRelations },
	})
}

export const db = createDb()
