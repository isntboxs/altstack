import { eq, inArray } from 'drizzle-orm'

import type { db } from '@altstack/db'
import { category, categoryPath, projectCategory } from '@altstack/db/schemas'

interface CategoryItem {
	name: string
	slug: string
	description: string
	parentSlug?: string
}

// Parent-first. The existing flat taxonomy remains separate from the new tree.
const seedCategories: Array<CategoryItem> = [
	{
		name: 'Frontend',
		slug: 'frontend',
		description: 'UI frameworks, client-side routing, and browser tooling.',
	},
	{
		name: 'Backend',
		slug: 'backend',
		description: 'Servers, APIs, and server-side frameworks.',
	},
	{
		name: 'Database',
		slug: 'database',
		description: 'ORMs, query builders, and database tooling.',
	},
	{
		name: 'Auth',
		slug: 'auth',
		description: 'Authentication and authorization libraries.',
	},
	{
		name: 'Devtools',
		slug: 'devtools',
		description:
			'Developer productivity: agents, validators, formatters, linters.',
	},
	{
		name: 'Styling',
		slug: 'styling',
		description: 'CSS frameworks and component libraries.',
	},
	{
		name: 'Developer Tools',
		slug: 'developer-tools',
		description:
			'Tools for writing, exploring, debugging, and maintaining software.',
	},
	{
		name: 'IDEs & Code Editors',
		slug: 'ides-code-editors',
		parentSlug: 'developer-tools',
		description:
			'Integrated development environments and editors for working with source code.',
	},
	{
		name: 'General Purpose Editors',
		slug: 'general-purpose-editors',
		parentSlug: 'ides-code-editors',
		description:
			'Flexible code editors for everyday development across languages and projects.',
	},
	{
		name: 'AI-Powered Editors',
		slug: 'ai-powered-editors',
		parentSlug: 'ides-code-editors',
		description:
			'Code editors with AI assistance for completion, navigation, and collaborative coding.',
	},
]

// No environment, singleton connection, or network side effects on import.
export async function seedTaxonomy(database: typeof db) {
	await database.transaction(async (tx) => {
		const seededIds = new Map<string, string>()
		for (const { parentSlug, ...entry } of seedCategories) {
			const parentId = parentSlug ? seededIds.get(parentSlug) : null
			if (parentSlug && !parentId) {
				throw new Error(`Seed parent must precede category: ${entry.slug}`)
			}

			const inserted = await tx
				.insert(category)
				.values({ ...entry, parentId })
				.onConflictDoNothing({ target: category.slug })
				.returning({ id: category.id })
			if (inserted.length > 0 && parentId) {
				const [assigned] = await tx
					.select({ categoryId: projectCategory.categoryId })
					.from(projectCategory)
					.where(eq(projectCategory.categoryId, parentId))
					.limit(1)
				if (assigned) {
					throw new Error(
						`Seed parent has direct project assignments: ${parentSlug}`
					)
				}
			}

			const [existing] = await tx
				.select({ id: category.id })
				.from(category)
				.where(eq(category.slug, entry.slug))
			if (!existing) {
				throw new Error(`Seed category could not be resolved: ${entry.slug}`)
			}
			seededIds.set(entry.slug, existing.id)
		}

		// Existing entries may have been moved by an admin. Walk their actual
		// ancestry, including ancestors outside this seed, without rewriting it.
		const categories = await tx.select().from(category)
		const byId = new Map(categories.map((row) => [row.id, row]))
		const paths = [...seededIds.values()].map((categoryId) => {
			const segments: Array<string> = []
			const visited = new Set<string>()
			let id: string | null = categoryId
			while (id) {
				if (visited.has(id)) {
					throw new Error(
						`Cannot seed a path for cyclic ancestry: ${categoryId}`
					)
				}
				visited.add(id)
				const row = byId.get(id)
				if (!row) {
					throw new Error(`Cannot resolve seed ancestor: ${id}`)
				}
				segments.unshift(row.slug)
				id = row.parentId
			}
			return { categoryId, path: segments.join('/') }
		})

		await tx
			.insert(categoryPath)
			.values(paths)
			.onConflictDoNothing({ target: categoryPath.path })
		const existingPaths = await tx
			.select()
			.from(categoryPath)
			.where(
				inArray(
					categoryPath.path,
					paths.map((row) => row.path)
				)
			)
		const owners = new Map(
			existingPaths.map((row) => [row.path, row.categoryId])
		)
		for (const { path, categoryId } of paths) {
			if (owners.get(path) !== categoryId) {
				throw new Error(
					`Category path is already reserved by another category: ${path}`
				)
			}
		}
	})
}
