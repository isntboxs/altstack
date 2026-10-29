import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from 'vite-plus/test'

import { findReservedProjectSlugs } from '@altstack/db/project-slug-preflight'
import { project } from '@altstack/db/schemas'

import { connectTestPostgres } from './helpers/postgres'

const execute = promisify(execFile)
const script = fileURLToPath(
	new URL('../scripts/check-project-slugs.ts', import.meta.url)
)
let postgres: Awaited<ReturnType<typeof connectTestPostgres>>
let scope: Awaited<ReturnType<typeof postgres.createSchema>>

beforeAll(async () => {
	postgres = await connectTestPostgres()
	scope = await postgres.createSchema()
	await migrate(scope.db, {
		migrationsFolder: fileURLToPath(
			new URL('../src/migrations', import.meta.url)
		),
		migrationsSchema: scope.migrationsSchema,
	})
})
beforeEach(async () => {
	await scope.db.delete(project)
})
afterAll(async () => {
	await postgres.close()
})

describe('reserved project-slug rollout check', () => {
	it('allows an empty database before its first migration without creating tables', async () => {
		const empty = await postgres.createSchema()
		try {
			expect(await findReservedProjectSlugs(empty.pool)).toEqual([])
			const result = await execute('vpx', [script], {
				env: { ...process.env, DATABASE_URL: empty.url },
			})
			expect(result.stdout).toContain(
				'No reserved project-slug collisions found.'
			)
			const relation = await empty.pool.query(
				"SELECT to_regclass('projects') AS name"
			)
			expect(relation.rows).toEqual([{ name: null }])
		} finally {
			await empty.close()
		}
	})
	it('reports legacy collections and other reserved slugs in every status and exits unsuccessfully without renaming them', async () => {
		const rows = await scope.db
			.insert(project)
			.values([
				{
					name: 'Legacy published',
					slug: 'collections',
					status: 'published',
					repositoryUrl: 'https://github.com/fixtures/legacy-published',
				},
				{
					name: 'Legacy draft',
					slug: 'tags',
					status: 'draft',
					repositoryUrl: 'https://github.com/fixtures/legacy-draft',
				},
				{
					name: 'Legacy rejected',
					slug: 'licenses',
					status: 'rejected',
					repositoryUrl: 'https://github.com/fixtures/legacy-rejected',
				},
				{
					name: 'Legacy removed',
					slug: 'activity',
					status: 'removed',
					repositoryUrl: 'https://github.com/fixtures/legacy-removed',
				},
				{
					name: 'Reachable project',
					slug: 'collections-project',
					status: 'published',
					repositoryUrl: 'https://github.com/fixtures/reachable',
				},
			])
			.returning({ id: project.id, slug: project.slug, status: project.status })
		const expected = rows
			.filter((row) => row.slug !== 'collections-project')
			.toSorted((a, b) => a.slug.localeCompare(b.slug))
		expect(await findReservedProjectSlugs(scope.pool)).toEqual(expected)
		const execution = execute('vpx', [script], {
			env: { ...process.env, DATABASE_URL: scope.url },
		})
		await expect(execution).rejects.toMatchObject({ code: 1 })
		await expect(execution).rejects.toThrow('/collections (published)')
		expect(await findReservedProjectSlugs(scope.pool)).toEqual(expected)
	})
	it('passes once a legacy collision has been renamed to an available slug', async () => {
		await scope.db.insert(project).values({
			name: 'Legacy project',
			slug: 'collections',
			status: 'published',
			repositoryUrl: 'https://github.com/fixtures/legacy-project',
		})
		expect(await findReservedProjectSlugs(scope.pool)).toHaveLength(1)
		await scope.db
			.update(project)
			.set({ slug: 'collections-project' })
			.where(eq(project.slug, 'collections'))
		expect(await findReservedProjectSlugs(scope.pool)).toEqual([])
		const result = await execute('vpx', [script], {
			env: { ...process.env, DATABASE_URL: scope.url },
		})
		expect(result.stdout).toContain(
			'No reserved project-slug collisions found.'
		)
	})
})
