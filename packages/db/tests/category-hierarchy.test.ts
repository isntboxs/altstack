import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { randomUUID } from 'node:crypto'
import { cp, mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from 'vite-plus/test'

import {
	category,
	categoryPath,
	githubRepository,
	project,
	projectCategory,
} from '@altstack/db/schemas'
import { seedTaxonomy } from '@altstack/db/seed-taxonomy'

import { createZedFixture } from './fixtures/category-hierarchy'
import { connectTestPostgres } from './helpers/postgres'

const migrationsFolder = fileURLToPath(
	new URL('../src/migrations', import.meta.url)
)
interface LegacyCategoryRow {
	id: string
	slug: string
	name: string
	description: string | null
	created_at: Date
	updated_at: Date
}
let postgres: Awaited<ReturnType<typeof connectTestPostgres>> | undefined
let database: Awaited<ReturnType<NonNullable<typeof postgres>['createSchema']>>
let currentScope: typeof database | undefined
let baselineFolder: string | undefined

beforeAll(async () => {
	postgres = await connectTestPostgres()
	baselineFolder = await mkdtemp(join(tmpdir(), 'altstack-baseline-'))
	const migrations = (await readdir(migrationsFolder)).toSorted()
	const hierarchy = migrations.find((name) =>
		name.endsWith('_category-hierarchy')
	)
	if (!hierarchy) throw new Error('Category hierarchy migration is missing')
	for (const name of migrations.filter((entry) => entry < hierarchy)) {
		await cp(join(migrationsFolder, name), join(baselineFolder, name), {
			recursive: true,
		})
	}
}, 60_000)

beforeEach(async () => {
	currentScope = undefined
	if (!postgres) throw new Error('Cloud development connection is missing')
	database = await postgres.createSchema()
	currentScope = database
}, 60_000)

afterEach(async () => {
	await currentScope?.close()
}, 60_000)

afterAll(async () => {
	try {
		await postgres?.close()
	} finally {
		if (baselineFolder) {
			await rm(baselineFolder, { recursive: true, force: true })
		}
	}
}, 60_000)

async function migrateCurrent() {
	await migrate(database.db, {
		migrationsFolder,
		migrationsSchema: database.migrationsSchema,
	})
}

async function taxonomyState() {
	return {
		categories: await database.db
			.select()
			.from(category)
			.orderBy(category.slug),
		paths: await database.db
			.select()
			.from(categoryPath)
			.orderBy(categoryPath.path),
		assignments: await database.db
			.select()
			.from(projectCategory)
			.orderBy(projectCategory.projectId, projectCategory.categoryId),
	}
}

describe('category hierarchy migrations', () => {
	it('applies the full migration chain to an empty DB and reruns without changes', async () => {
		await migrateCurrent()
		const before = await database.pool.query(
			`SELECT * FROM "${database.migrationsSchema}".__drizzle_migrations ORDER BY id`
		)
		await migrateCurrent()
		expect(
			(
				await database.pool.query(
					`SELECT * FROM "${database.migrationsSchema}".__drizzle_migrations ORDER BY id`
				)
			).rows
		).toEqual(before.rows)
		expect(await database.db.select().from(category)).toEqual([])
		expect(await database.db.select().from(categoryPath)).toEqual([])
		const indexes = await database.pool.query<{ indexname: string }>(
			"SELECT indexname FROM pg_indexes WHERE schemaname = $1 AND tablename IN ('categories', 'category_paths')",
			[database.migrationsSchema]
		)
		expect(indexes.rows.map((row) => row.indexname)).toEqual(
			expect.arrayContaining([
				'category_parent_idx',
				'category_path_category_idx',
				'category_paths_pkey',
			])
		)
	})

	it('upgrades existing flat categories and backfills paths without remapping data', async () => {
		if (!baselineFolder) {
			throw new Error('Baseline migration folder is missing')
		}
		await migrate(database.db, {
			migrationsFolder: baselineFolder,
			migrationsSchema: database.migrationsSchema,
		})
		const categoryIds = [randomUUID(), randomUUID(), randomUUID()]
		for (const [index, slug] of [
			'devtools',
			'backend',
			'admin-custom',
		].entries()) {
			await database.pool.query(
				`INSERT INTO categories (id, slug, name, description, created_at, updated_at)
				 VALUES ($1, $2, $3, $4, '2026-01-01', '2026-02-01')`,
				[
					categoryIds[index],
					slug,
					`Existing ${slug}`,
					`Admin description for ${slug}`,
				]
			)
		}
		const {
			rows: [legacyProject],
		} = await database.pool.query<{ id: string }>(`
			INSERT INTO projects (name, slug, tagline, description, logo, repository_url, status)
			VALUES ('Legacy project', 'legacy', 'Legacy fixture', 'Existing published project with two root assignments.', 'legacy.svg', 'https://github.com/test-only/legacy', 'published') RETURNING id
		`)
		if (!legacyProject) throw new Error('Missing legacy project')
		await database.db.insert(projectCategory).values(
			categoryIds.slice(0, 2).map((categoryId) => {
				return {
					projectId: legacyProject.id,
					categoryId,
				}
			})
		)
		const oldCategories = (
			await database.pool.query<LegacyCategoryRow>(
				'SELECT * FROM categories ORDER BY slug'
			)
		).rows
		const oldAssignments = await database.db
			.select()
			.from(projectCategory)
			.orderBy(projectCategory.categoryId)
		const oldProjects = (
			await database.pool.query<Record<string, unknown>>(
				'SELECT * FROM projects'
			)
		).rows

		await migrateCurrent()
		expect(
			(await database.pool.query('SELECT * FROM categories ORDER BY slug')).rows
		).toEqual(
			oldCategories.map((row) => {
				return { ...row, parent_id: null }
			})
		)
		expect(
			(
				await database.pool.query<Record<string, unknown>>(
					'SELECT * FROM projects'
				)
			).rows
		).toEqual(
			oldProjects.map((row) => {
				return { ...row, submitter_id: null, rejection_reason: null }
			})
		)
		expect(
			await database.db
				.select()
				.from(projectCategory)
				.orderBy(projectCategory.categoryId)
		).toEqual(oldAssignments)
		expect(
			await database.db.select().from(categoryPath).orderBy(categoryPath.path)
		).toEqual(
			['devtools', 'backend', 'admin-custom']
				.map((path, index) => {
					return { path, categoryId: categoryIds[index] }
				})
				.toSorted((a, b) => a.path.localeCompare(b.path))
		)
		await seedTaxonomy(database.db)
		await seedTaxonomy(database.db)
		expect(
			await database.db
				.select()
				.from(projectCategory)
				.orderBy(projectCategory.categoryId)
		).toEqual(oldAssignments)
		const oldDevtools = await database.db.query.category.findFirst({
			where: { slug: 'devtools' },
			with: { children: true },
		})
		expect(oldDevtools).toMatchObject({
			id: categoryIds[0],
			parentId: null,
			name: 'Existing devtools',
			children: [],
		})
	})
})

describe('category hierarchy schema and taxonomy', () => {
	beforeEach(migrateCurrent, 60_000)

	it('enforces parent FKs, restricts parent deletion, rejects self-parenting, and retains global slug uniqueness', async () => {
		const rootId = randomUUID()
		const childId = randomUUID()
		await database.pool.query(
			'INSERT INTO categories (id, slug, name) VALUES ($1, $2, $2)',
			[rootId, 'root']
		)
		await expect(
			database.pool.query(
				'INSERT INTO categories (slug, name, parent_id) VALUES ($1, $1, $2)',
				['orphan', randomUUID()]
			)
		).rejects.toMatchObject({ code: '23503' })
		await expect(
			database.pool.query(
				'INSERT INTO categories (id, slug, name, parent_id) VALUES ($1, $2, $2, $1)',
				[childId, 'self']
			)
		).rejects.toMatchObject({
			code: '23514',
			constraint: 'categories_not_self_parent_check',
		})
		await expect(
			database.pool.query(
				'UPDATE categories SET parent_id = id WHERE id = $1',
				[rootId]
			)
		).rejects.toMatchObject({ code: '23514' })
		await database.pool.query(
			'INSERT INTO categories (id, slug, name, parent_id) VALUES ($1, $2, $2, $3)',
			[childId, 'child', rootId]
		)
		await expect(
			database.pool.query('DELETE FROM categories WHERE id = $1', [rootId])
		).rejects.toMatchObject({
			code: '23001',
			constraint: 'categories_parent_id_categories_id_fkey',
		})
		await expect(
			database.pool.query(
				'INSERT INTO categories (slug, name, parent_id) VALUES ($1, $1, $2)',
				['root', rootId]
			)
		).rejects.toMatchObject({ code: '23505' })
		await database.pool.query('DELETE FROM categories WHERE id = $1', [childId])
		await database.pool.query('DELETE FROM categories WHERE id = $1', [rootId])
	})

	it('reserves each path once, permits historical paths, requires a category, and cascades paths on deletion', async () => {
		const [row] = await database.db
			.insert(category)
			.values({ slug: 'current', name: 'Current' })
			.returning()
		if (!row) throw new Error('Missing category')
		await database.db.insert(categoryPath).values([
			{ path: 'current', categoryId: row.id },
			{ path: 'old-parent/old-slug', categoryId: row.id },
		])
		await expect(
			database.pool.query(
				'INSERT INTO category_paths (path, category_id) VALUES ($1, $2)',
				['current', row.id]
			)
		).rejects.toMatchObject({ code: '23505' })
		await expect(
			database.pool.query(
				'INSERT INTO category_paths (path, category_id) VALUES ($1, $2)',
				['orphan', randomUUID()]
			)
		).rejects.toMatchObject({ code: '23503' })
		await expect(
			database.pool.query(
				"INSERT INTO category_paths (path) VALUES ('missing-category')"
			)
		).rejects.toMatchObject({ code: '23502' })
		await database.db.delete(category).where(eq(category.id, row.id))
		expect(await database.db.select().from(categoryPath)).toEqual([])
	})

	it('seeds the ten categories and actual paths twice without changing IDs, timestamps, or descriptions', async () => {
		await seedTaxonomy(database.db)
		const before = await taxonomyState()
		expect(before.categories).toHaveLength(10)
		expect(before.paths).toHaveLength(10)
		await seedTaxonomy(database.db)
		expect(await taxonomyState()).toEqual(before)
		expect(before.paths.map((row) => row.path)).toEqual([
			'auth',
			'backend',
			'database',
			'developer-tools',
			'developer-tools/ides-code-editors',
			'developer-tools/ides-code-editors/ai-powered-editors',
			'developer-tools/ides-code-editors/general-purpose-editors',
			'devtools',
			'frontend',
			'styling',
		])
		expect(
			before.categories
				.filter((row) =>
					[
						'frontend',
						'backend',
						'database',
						'auth',
						'devtools',
						'styling',
					].includes(row.slug)
				)
				.every((row) => row.parentId === null)
		).toBe(true)
		expect(await database.db.select().from(project)).toEqual([])
	})

	it('preserves admin-edited entries and uses actual ancestry, including ancestors outside the seed', async () => {
		await seedTaxonomy(database.db)
		const [customRoot] = await database.db
			.insert(category)
			.values({ slug: 'workbench', name: 'Workbench' })
			.returning()
		if (!customRoot) throw new Error('Missing custom root')
		await database.db
			.update(category)
			.set({
				parentId: customRoot.id,
				name: 'My Editors',
				description: 'Admin description',
			})
			.where(eq(category.slug, 'ides-code-editors'))
		const edited = await database.db
			.select()
			.from(category)
			.orderBy(category.slug)
		await seedTaxonomy(database.db)
		expect(
			await database.db.select().from(category).orderBy(category.slug)
		).toEqual(edited)
		const editor = edited.find((row) => row.slug === 'ides-code-editors')
		expect(
			await database.db
				.select()
				.from(categoryPath)
				.where(eq(categoryPath.path, 'workbench/ides-code-editors'))
		).toEqual([{ path: 'workbench/ides-code-editors', categoryId: editor?.id }])
		expect(
			await database.db
				.select()
				.from(categoryPath)
				.where(eq(categoryPath.path, 'developer-tools/ides-code-editors'))
		).toEqual([
			{ path: 'developer-tools/ides-code-editors', categoryId: editor?.id },
		])
		const beforeRerun = await taxonomyState()
		await seedTaxonomy(database.db)
		expect(await taxonomyState()).toEqual(beforeRerun)
	})

	it('keeps a pre-existing seed entry at its current parent and attaches missing descendants to it', async () => {
		const [existing] = await database.db
			.insert(category)
			.values({
				slug: 'ides-code-editors',
				name: 'Existing editors',
				description: 'Keep this',
			})
			.returning()
		if (!existing) throw new Error('Missing pre-existing editors')
		await seedTaxonomy(database.db)
		const current = await database.db.query.category.findFirst({
			where: { id: existing.id },
			with: { children: true },
		})
		expect(current).toMatchObject(existing)
		expect(current?.children).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					slug: 'general-purpose-editors',
					parentId: existing.id,
				}),
				expect.objectContaining({
					slug: 'ai-powered-editors',
					parentId: existing.id,
				}),
			])
		)
		expect(
			(await database.db.select().from(categoryPath)).map((row) => row.path)
		).toContain('ides-code-editors/general-purpose-editors')
	})

	it("rejects another category's historical path and rolls back the entire taxonomy seed", async () => {
		const [owner] = await database.db
			.insert(category)
			.values({ slug: 'historical-owner', name: 'Historical owner' })
			.returning()
		if (!owner) throw new Error('Missing historical owner')
		const reserved = 'developer-tools/ides-code-editors/general-purpose-editors'
		await database.db
			.insert(categoryPath)
			.values({ path: reserved, categoryId: owner.id })
		const before = await taxonomyState()
		await expect(seedTaxonomy(database.db)).rejects.toThrow(
			`Category path is already reserved by another category: ${reserved}`
		)
		expect(await taxonomyState()).toEqual(before)
	})

	it('keeps depth, cycles, and leaf-assignment enforcement out of the DB while guarding seed traversal', async () => {
		const fixture = await createZedFixture(database.db)
		try {
			const root = await database.db.query.category.findFirst({
				where: { slug: 'developer-tools' },
			})
			const leaf = fixture.leaves[0]
			if (!root || !leaf) throw new Error('Missing hierarchy fixture')
			await database.db.insert(category).values({
				slug: 'fourth-level',
				name: 'Fourth level',
				parentId: leaf.id,
			})
			await database.db
				.insert(projectCategory)
				.values({ projectId: fixture.projectId, categoryId: root.id })
			await database.db
				.update(category)
				.set({ parentId: leaf.id })
				.where(eq(category.id, root.id))
			const before = await taxonomyState()
			await expect(seedTaxonomy(database.db)).rejects.toThrow(
				'Cannot seed a path for cyclic ancestry'
			)
			expect(await taxonomyState()).toEqual(before)
		} finally {
			await fixture.dispose()
		}
	})

	it('creates a test-only Zed fixture with two direct leaf assignments and traversable parent/children relations', async () => {
		const fixture = await createZedFixture(database.db)
		try {
			const root = await database.db.query.category.findFirst({
				where: { slug: 'developer-tools' },
				with: {
					parent: true,
					children: {
						with: {
							parent: true,
							children: {
								with: { parent: true, paths: { with: { category: true } } },
							},
						},
					},
				},
			})
			expect(root?.parent).toBeNull()
			expect(root?.children).toHaveLength(1)
			const editors = root?.children[0]
			expect(editors?.parent?.id).toBe(root?.id)
			expect(editors?.children.map((row) => row.id).toSorted()).toEqual(
				fixture.leaves.map((row) => row.id).toSorted()
			)
			for (const leaf of editors?.children ?? []) {
				expect(leaf.parent?.id).toBe(editors?.id)
				expect(leaf.paths[0]?.category.id).toBe(leaf.id)
			}
			const zed = await database.db.query.project.findFirst({
				where: { id: fixture.projectId },
				with: {
					githubRepository: true,
					projectCategories: { with: { category: true } },
				},
			})
			expect(zed).toMatchObject({
				name: 'Zed',
				status: 'draft',
				githubRepository: {
					owner: 'altstack-test-fixtures',
					stars: 123,
					forks: 12,
				},
			})
			expect(
				zed?.projectCategories.map((row) => row.category?.slug).toSorted()
			).toEqual(['ai-powered-editors', 'general-purpose-editors'])
		} finally {
			await fixture.dispose()
		}
		expect(await database.db.select().from(project)).toEqual([])
		expect(await database.db.select().from(githubRepository)).toEqual([])
		expect(await database.db.select().from(projectCategory)).toEqual([])
	})
})
