import dotenv from 'dotenv'
import { drizzle } from 'drizzle-orm/node-postgres'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'

import { relations } from '@altstack/db/relations'

const DEVELOPMENT_DATABASE = 'altstack_development'

export function validateDevelopmentUrl(value: string) {
	let url: URL
	try {
		url = new URL(value)
	} catch {
		throw new Error('Expected a PostgreSQL URL for altstack_development')
	}
	if (
		!['postgres:', 'postgresql:'].includes(url.protocol) ||
		url.pathname !== `/${DEVELOPMENT_DATABASE}` ||
		(url.searchParams.has('database') &&
			url.searchParams.get('database') !== DEVELOPMENT_DATABASE)
	) {
		throw new Error('Database tests require altstack_development')
	}
	return url
}

export function schemaConnectionUrl(value: string, schema: string) {
	if (schema !== 'public' && !/^altstack_test_[a-f0-9]{32}$/.test(schema)) {
		throw new Error('Invalid test schema name')
	}
	const url = validateDevelopmentUrl(value)
	const options = url.searchParams.get('options')
	url.searchParams.set(
		'options',
		[options, `-c search_path=${schema},pg_catalog`].filter(Boolean).join(' ')
	)
	return url.toString()
}

function developmentUrl() {
	dotenv.config({
		path: fileURLToPath(new URL('../../../../.env', import.meta.url)),
		quiet: true,
	})
	const value = process.env.DATABASE_URL
	if (!value) throw new Error('DATABASE_URL is not defined')
	return value
}

// Use the authorized cloud DB. Each DB case owns a separate schema, never a
// different database or server. The workspace wrapper explicitly resets public.
export async function connectTestPostgres(value = developmentUrl()) {
	const url = schemaConnectionUrl(value, 'public')
	const pool = new Pool({
		connectionString: url,
		max: 5,
		connectionTimeoutMillis: 10_000,
	})
	async function resetSchemas(names: Array<string>) {
		const client = await pool.connect()
		try {
			const result = await client.query<{ name: string }>(
				'SELECT current_database() AS name'
			)
			if (result.rows[0]?.name !== DEVELOPMENT_DATABASE) {
				throw new Error('Connected database must be altstack_development')
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
		if (result.rows[0]?.name !== DEVELOPMENT_DATABASE) {
			throw new Error('Connected database must be altstack_development')
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
