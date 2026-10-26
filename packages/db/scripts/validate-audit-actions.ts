import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'

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
	// Run after db:migrate commits. Drizzle batches migration files in one
	// transaction, which would retain the earlier ACCESS EXCLUSIVE table lock.
	await pool.query(
		'ALTER TABLE "audit_log" VALIDATE CONSTRAINT "audit_log_action_check"'
	)
	process.stdout.write('Audit action constraint validated.\n')
} finally {
	await pool.end()
}
