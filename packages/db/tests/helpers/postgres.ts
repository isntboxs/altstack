import { drizzle } from 'drizzle-orm/node-postgres'
import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { setTimeout } from 'node:timers/promises'
import { promisify } from 'node:util'
import { Pool } from 'pg'

import { relations } from '@altstack/db/relations'

const exec = promisify(execFile)

// Always a new local server, with no mounted volumes. Never read DATABASE_URL.
export async function startTestPostgres() {
	const container = `altstack-db-test-${randomUUID()}`
	const databases: Array<{ name: string; pool: Pool }> = []
	let admin: Pool | undefined
	try {
		await exec(
			'docker',
			[
				'run',
				'--detach',
				'--rm',
				'--name',
				container,
				'--publish',
				'127.0.0.1::5432',
				'--tmpfs',
				'/var/lib/postgresql',
				'--env',
				'POSTGRES_PASSWORD=altstack-test-only',
				'postgres:18',
			],
			{ timeout: 60_000 }
		)
		const { stdout } = await exec('docker', ['port', container, '5432/tcp'])
		const port = /^127\.0\.0\.1:(\d+)\s*$/.exec(stdout)?.[1]
		if (!port) throw new Error('Expected a loopback-only test PostgreSQL port')
		const serverUrl = `postgresql://postgres:altstack-test-only@127.0.0.1:${port}`
		admin = new Pool({
			connectionString: `${serverUrl}/postgres`,
			connectionTimeoutMillis: 1000,
		})
		let ready = false
		for (let attempt = 0; attempt < 100; attempt++) {
			try {
				await admin.query('SELECT 1')
				ready = true
				break
			} catch {
				await setTimeout(100)
			}
		}
		if (!ready) throw new Error('Disposable PostgreSQL did not become ready')
		const adminPool = admin
		return {
			async createDatabase() {
				const name = `altstack_test_${randomUUID().replaceAll('-', '')}`
				await adminPool.query(`CREATE DATABASE "${name}"`)
				const url = `${serverUrl}/${name}`
				const pool = new Pool({ connectionString: url, max: 5 })
				databases.push({ name, pool })
				return { url, pool, db: drizzle({ client: pool, relations }) }
			},
			async close() {
				try {
					for (const { pool } of databases) await pool.end()
					await adminPool.end()
				} finally {
					await exec('docker', ['rm', '--force', container])
				}
			},
		}
	} catch (error) {
		await admin?.end()
		await exec('docker', ['rm', '--force', container]).catch(() => undefined)
		throw error
	}
}
