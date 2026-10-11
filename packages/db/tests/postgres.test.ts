import { afterAll, beforeAll, describe, expect, it, vi } from 'vite-plus/test'

import {
	category,
	categoryPath,
	githubRepository,
	project,
	projectCategory,
} from '@altstack/db/schemas'

import {
	connectTestPostgres,
	schemaConnectionUrl,
	validateDevelopmentUrl,
} from './helpers/postgres'
import { withWorkspaceDatabase } from './helpers/workspace'

describe('cloud database target validation', () => {
	it.each([
		'postgresql://test:secret@cloud.test/altstack_production',
		'postgresql://test:secret@cloud.test/postgres',
		'postgresql://test:secret@cloud.test/altstack_development?database=altstack_production',
		'https://cloud.test/altstack_development',
		'not-a-url',
	])(
		'rejects unauthorized database targets before connecting: %s',
		async (url) => {
			await expect(connectTestPostgres(url)).rejects.toThrow(
				/altstack_development/
			)
		}
	)

	it('accepts the development target and preserves TLS settings and existing connection options', () => {
		const original =
			'postgresql://test:secret@cloud.test:5432/altstack_development?sslmode=require&application_name=fixture&options=-c%20statement_timeout%3D10000'
		const schema = `altstack_test_${'a'.repeat(32)}`
		const scoped = new URL(schemaConnectionUrl(original, schema))
		expect(validateDevelopmentUrl(original).pathname).toBe(
			'/altstack_development'
		)
		expect(scoped.searchParams.get('sslmode')).toBe('require')
		expect(scoped.searchParams.get('application_name')).toBe('fixture')
		expect(scoped.searchParams.get('options')).toBe(
			`-c statement_timeout=10000 -c search_path=${schema},pg_catalog`
		)
		expect(scoped.hostname).toBe('cloud.test')
		expect(scoped.port).toBe('5432')
		expect(scoped.username).toBe('test')
		expect(scoped.password).toBe('secret')
		expect(scoped.pathname).toBe('/altstack_development')
		expect(() =>
			schemaConnectionUrl(original, 'public; DROP DATABASE other')
		).toThrow('Invalid test schema name')
	})
})

describe('cloud test schema lifecycle', () => {
	let postgres: Awaited<ReturnType<typeof connectTestPostgres>> | undefined
	beforeAll(async () => {
		postgres = await connectTestPostgres()
	}, 60_000)
	afterAll(async () => {
		await postgres?.close()
	}, 60_000)

	it('rejects concurrent verification before reset while allowing independent schemas', async () => {
		if (!postgres) throw new Error('Missing cloud connection')
		const first = await postgres.createSchema()
		const second = await postgres.createSchema()
		const contenderReset = vi.fn(async () => first.reset())
		const contenderWork = vi.fn(() => Promise.resolve())
		try {
			await withWorkspaceDatabase(first, async () => {
				const baseline = await first.db.query.project.findFirst()
				await expect(
					withWorkspaceDatabase(
						{ ...first, reset: contenderReset },
						contenderWork
					)
				).rejects.toThrow('Another workspace verification')
				expect(contenderReset).not.toHaveBeenCalled()
				expect(contenderWork).not.toHaveBeenCalled()
				await withWorkspaceDatabase(second, async () => {
					expect(await second.db.select().from(project)).toHaveLength(1)
				})
				expect(await first.db.query.project.findFirst()).toEqual(baseline)
			})
			expect(first.pool.totalCount - first.pool.idleCount).toBe(0)
			expect(second.pool.totalCount - second.pool.idleCount).toBe(0)
		} finally {
			await first.close()
			await second.close()
		}
	})

	it.each(['initial restoration', 'work', 'final restoration'])(
		'holds the lock through both resets and releases the client after %s fails',
		async (failure) => {
			if (!postgres) throw new Error('Missing cloud connection')
			const scope = await postgres.createSchema()
			let resets = 0
			const work = vi.fn(async () => {
				expect(await scope.db.select().from(project)).toHaveLength(1)
				if (failure === 'work') throw new Error('Synthetic work failure')
			})
			try {
				await expect(
					withWorkspaceDatabase(
						{
							...scope,
							async reset() {
								resets += 1
								const contenderReset = vi.fn(async () => scope.reset())
								await expect(
									withWorkspaceDatabase(
										{ ...scope, reset: contenderReset },
										() => Promise.resolve()
									)
								).rejects.toThrow('Another workspace verification')
								expect(contenderReset).not.toHaveBeenCalled()
								if (
									(failure === 'initial restoration' && resets === 1) ||
									(failure === 'final restoration' && resets === 2)
								) {
									throw new Error(`Synthetic ${failure} failure`)
								}
								await scope.reset()
							},
						},
						work
					)
				).rejects.toThrow(`Synthetic ${failure} failure`)
				expect(resets).toBe(2)
				expect(work).toHaveBeenCalledTimes(
					failure === 'initial restoration' ? 0 : 1
				)
				expect(scope.pool.totalCount - scope.pool.idleCount).toBe(0)
				// A new verification must acquire the released lock after every failure.
				await withWorkspaceDatabase(scope, async () => {
					expect(await scope.db.select().from(project)).toHaveLength(1)
				})
				expect(await scope.db.select().from(project)).toEqual([])
				expect(scope.pool.totalCount - scope.pool.idleCount).toBe(0)
			} finally {
				await scope.close()
			}
		}
	)

	it('isolates tables and ledger between schemas and removes scopes after a thrown failure', async () => {
		if (!postgres) throw new Error('Missing cloud connection')
		const first = await postgres.createSchema()
		const second = await postgres.createSchema()
		try {
			await first.pool.query('CREATE TABLE schema_marker (value text)')
			await first.pool.query("INSERT INTO schema_marker VALUES ('first')")
			await expect(
				second.pool.query('SELECT * FROM schema_marker')
			).rejects.toMatchObject({ code: '42P01' })
			await expect(
				withWorkspaceDatabase(first, async () => {
					await first.db.insert(category).values({
						slug: 'test-failed-work',
						name: 'Failed verification fixture',
					})
					throw new Error('Synthetic verification failure')
				})
			).rejects.toThrow('Synthetic verification failure')
			expect(await first.db.select().from(project)).toEqual([])
			expect(await first.db.select().from(githubRepository)).toEqual([])
			expect(await first.db.select().from(projectCategory)).toEqual([])
			expect(await first.db.select().from(category)).toHaveLength(10)
			expect(await first.db.select().from(categoryPath)).toHaveLength(10)
			await expect(
				second.pool.query('SELECT * FROM __drizzle_migrations')
			).rejects.toMatchObject({ code: '42P01' })
		} finally {
			await first.close()
			await second.close()
		}
		const schemas = await postgres.pool.query<{ nspname: string }>(
			'SELECT nspname FROM pg_namespace WHERE nspname = ANY($1::text[])',
			[[first.migrationsSchema, second.migrationsSchema]]
		)
		expect(schemas.rows).toEqual([])
	})

	it('restores a migrated taxonomy and clears project fixtures after successful verification', async () => {
		if (!postgres) throw new Error('Missing cloud connection')
		const scope = await postgres.createSchema()
		try {
			const result = await withWorkspaceDatabase(scope, async () => {
				const baseline = await scope.db.query.project.findFirst({
					with: { githubRepository: true, projectCategories: true },
				})
				expect(baseline).toMatchObject({
					slug: 'test-workspace-baseline',
					status: 'published',
				})
				expect(baseline?.projectCategories).toHaveLength(1)
				return 17
			})
			expect(result).toBe(17)
			expect(await scope.db.select().from(project)).toEqual([])
			expect(await scope.db.select().from(category)).toHaveLength(10)
			expect(await scope.db.select().from(categoryPath)).toHaveLength(10)
			const ledger = await scope.pool.query<{ name: string }>(
				'SELECT name FROM __drizzle_migrations ORDER BY id'
			)
			expect(ledger.rows.at(-1)?.name).toMatch(/_github-stars-history$/)
		} finally {
			await scope.close()
		}
	})
})
