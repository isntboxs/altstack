import dotenv from 'dotenv'
import { drizzle } from 'drizzle-orm/node-postgres'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'

import { relations } from '@altstack/db/relations'

const TEST_DATABASE = 'altstack_test'

export function validateTestUrl(value: string) {
	let url: URL
	try {
		url = new URL(value)
	} catch {
		throw new Error('Expected a local PostgreSQL URL for altstack_test')
	}
	if (
		!['postgres:', 'postgresql:'].includes(url.protocol) ||
		!['localhost', '127.0.0.1', '[::1]', 'postgres-test'].includes(
			url.hostname
		) ||
		url.port !== (url.hostname === 'postgres-test' ? '5432' : '5433') ||
		url.searchParams.has('host') ||
		url.searchParams.has('port') ||
		url.pathname !== `/${TEST_DATABASE}` ||
		(url.searchParams.has('database') &&
			url.searchParams.get('database') !== TEST_DATABASE)
	) {
		throw new Error(
			'Database tests require local Docker database altstack_test'
		)
	}
	return url
}

export function schemaConnectionUrl(value: string, schema: string) {
	if (schema !== 'public' && !/^altstack_test_[a-f0-9]{32}$/.test(schema)) {
		throw new Error('Invalid test schema name')
	}
	const url = validateTestUrl(value)
	const options = url.searchParams.get('options')
	url.searchParams.set(
		'options',
		[options, `-c search_path=${schema},pg_catalog`].filter(Boolean).join(' ')
	)
	return url.toString()
}

export function testDatabaseUrl() {
	dotenv.config({
		path: fileURLToPath(new URL('../../../../.env', import.meta.url)),
		quiet: true,
	})
	const value = process.env.TEST_DATABASE_URL
	if (!value) {
		throw new Error('TEST_DATABASE_URL is not defined; see .env.example')
	}
	return value
}

// Docker tests use their own database. Each DB case also owns a separate schema.
// The isolated workspace wrapper may reset public only in this test database.
export async function connectTestPostgres(value = testDatabaseUrl()) {
	const url = schemaConnectionUrl(value, 'public')
	const pool = new Pool({
		connectionString: url,
		max: 5,
		connectionTimeoutMillis: 10_000,
		// The workspace lock uses an otherwise idle session during long builds.
		// Keep its connection reachable until restoration and unlock.
		keepAlive: true,
		keepAliveInitialDelayMillis: 10_000,
	})
	async function resetSchemas(names: Array<string>) {
		const client = await pool.connect()
		try {
			const result = await client.query<{ name: string }>(
				'SELECT current_database() AS name'
			)
			if (result.rows[0]?.name !== TEST_DATABASE) {
				throw new Error('Connected database must be altstack_test')
			}
			await client.query('BEGIN')
			for (const name of names) {
				await client.query(`DROP SCHEMA IF EXISTS "${name}" CASCADE`)
			}
			if (names.includes('public')) {
				await client.query(
					'CREATE SCHEMA public AUTHORIZATION pg_database_owner'
				)
				await client.query('GRANT USAGE ON SCHEMA public TO PUBLIC')
			} else {
				for (const name of names) await client.query(`CREATE SCHEMA "${name}"`)
			}
			await client.query('COMMIT')
		} catch (error) {
			await client.query('ROLLBACK')
			throw error
		} finally {
			client.release()
		}
	}
	try {
		const result = await pool.query<{ name: string }>(
			'SELECT current_database() AS name'
		)
		if (result.rows[0]?.name !== TEST_DATABASE) {
			throw new Error('Connected database must be altstack_test')
		}
	} catch (error) {
		await pool.end()
		throw error
	}
	const scopes = new Map<string, { close(): Promise<void> }>()
	return {
		url,
		pool,
		db: drizzle({ client: pool, relations }),
		migrationsSchema: 'drizzle',
		async reset() {
			await resetSchemas(['public', 'drizzle'])
		},
		async createSchema() {
			const name = `altstack_test_${randomUUID().replaceAll('-', '')}`
			await pool.query(`CREATE SCHEMA "${name}"`)
			const scopedUrl = schemaConnectionUrl(url, name)
			const scopedPool = new Pool({
				connectionString: scopedUrl,
				max: 5,
				connectionTimeoutMillis: 10_000,
				keepAlive: true,
				keepAliveInitialDelayMillis: 10_000,
			})
			let poolClosed = false
			const scope = {
				url: scopedUrl,
				pool: scopedPool,
				db: drizzle({ client: scopedPool, relations }),
				migrationsSchema: name,
				async reset() {
					await resetSchemas([name])
				},
				async close() {
					if (!poolClosed) {
						poolClosed = true
						await scopedPool.end()
					}
					await pool.query(`DROP SCHEMA IF EXISTS "${name}" CASCADE`)
					scopes.delete(name)
				},
			}
			scopes.set(name, scope)
			return scope
		},
		async close() {
			let failure: unknown
			try {
				for (const scope of scopes.values()) {
					try {
						await scope.close()
					} catch (error) {
						failure ??= error
					}
				}
			} finally {
				await pool.end()
			}
			if (failure) throw failure
		},
	}
}
