import { ORPCError } from '@orpc/server'
import { eq, inArray, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import {
	getAdminCategoryById,
	listAdminCategories,
} from '@altstack/api/queries/category'

import type { db } from '@altstack/db'
import { category, categoryPath } from '@altstack/db/schemas'

import type {
	AdminCategoryNode,
	AdminCreateCategoryInput,
	AdminUpdateCategoryInput,
} from '@altstack/shared/schemas/admin-category'

type CategoryTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
type CategoryDatabase = Pick<typeof db, 'execute'>

// All API hierarchy mutations and direct assignment writes serialize here.
// Transaction scope releases the lock on commit/rollback; external image work
// happens before acquiring it. Separate test schemas use independent keys.
export async function lockCategoryIntegrity(tx: CategoryDatabase) {
	await tx.execute(sql`SELECT pg_advisory_xact_lock(
		hashtext('altstack.category-integrity'), hashtext(current_schema())
	)`)
}

export async function validateLeafCategoryAssignments(
	database: CategoryDatabase,
	slugs: Array<string>
) {
	const uniqueSlugs = [...new Set(slugs)]
	if (uniqueSlugs.length === 0 || uniqueSlugs.length > 3) {
		throw new ORPCError('BAD_REQUEST', {
			message: 'Choose 1–3 distinct leaf categories.',
		})
	}
	const result = await database.execute<{
		id: string
		slug: string
		isLeaf: boolean
	}>(sql`
		SELECT selected.id, selected.slug,
			NOT EXISTS (SELECT 1 FROM categories child WHERE child.parent_id = selected.id) AS "isLeaf"
		FROM categories selected WHERE selected.slug IN (${sql.join(
			uniqueSlugs.map((slug) => sql`${slug}`),
			sql`, `
		)})
	`)
	const bySlug = new Map(result.rows.map((row) => [row.slug, row]))
	return uniqueSlugs.map((slug) => {
		const node = bySlug.get(slug)
		if (!node) {
			throw new ORPCError('BAD_REQUEST', {
				message: `Category "${slug}" does not exist. Choose an existing leaf category.`,
			})
		}
		if (!node.isLeaf) {
			throw new ORPCError('BAD_REQUEST', {
				message: `Category "${slug}" has children. Assign a leaf category instead.`,
			})
		}
		return node.id
	})
}

function requireParent(
	nodes: Array<AdminCategoryNode>,
	parentId: string | null
) {
	if (parentId === null) return undefined
	const parent = nodes.find((node) => node.id === parentId)
	if (!parent) {
		throw new ORPCError('BAD_REQUEST', {
			message: 'Parent category does not exist.',
		})
	}
	if (parent.directProjectCount > 0) {
		throw new ORPCError('CONFLICT', {
			message:
				'Parent category has direct project assignments. Reassign those projects to other leaves before adding a child.',
		})
	}
	return parent
}

type OwnedPath = { path: string; categoryId: string }

async function checkPathOwnership(
	tx: CategoryTransaction,
	nodes: Array<AdminCategoryNode>,
	paths: Array<OwnedPath>
) {
	const currentOwners = new Map(nodes.map((node) => [node.path, node.id]))
	const historical = await tx
		.select()
		.from(categoryPath)
		.where(
			inArray(
				categoryPath.path,
				paths.map((entry) => entry.path)
			)
		)
	const historyOwners = new Map(
		historical.map((entry) => [entry.path, entry.categoryId])
	)
	for (const { path, categoryId } of paths) {
		const currentOwner = currentOwners.get(path)
		const historyOwner = historyOwners.get(path)
		if (
			(currentOwner !== undefined && currentOwner !== categoryId) ||
			(historyOwner !== undefined && historyOwner !== categoryId)
		) {
			throw new ORPCError('CONFLICT', {
				message: `Category path "${path}" belongs to another category. Choose a different slug or parent.`,
			})
		}
	}
}

async function requireUpdatedNode(tx: CategoryTransaction, id: string) {
	const detail = await getAdminCategoryById(tx, id)
	if (!detail) throw new ORPCError('INTERNAL_SERVER_ERROR')
	return detail.category
}

export async function createAdminCategory(
	database: typeof db,
	input: AdminCreateCategoryInput
) {
	return database.transaction(async (tx) => {
		await lockCategoryIntegrity(tx)
		const nodes = await listAdminCategories(tx)
		const parent = requireParent(nodes, input.parentId)
		if (parent && parent.depth >= 3) {
			throw new ORPCError('BAD_REQUEST', {
				message: 'Category hierarchy cannot exceed 3 levels.',
			})
		}
		// Slugs are globally unique, even when the proposed paths differ.
		const [slugOwner] = await tx
			.select({ id: category.id })
			.from(category)
			.where(eq(category.slug, input.slug))
		if (slugOwner) {
			throw new ORPCError('CONFLICT', {
				message: 'Category slug is already in use.',
			})
		}
		const id = randomUUID()
		const path = parent ? `${parent.path}/${input.slug}` : input.slug
		await checkPathOwnership(tx, nodes, [{ path, categoryId: id }])
		await tx.insert(category).values({ ...input, id })
		await tx.insert(categoryPath).values({ path, categoryId: id })
		return requireUpdatedNode(tx, id)
	})
}

export async function updateAdminCategory(
	database: typeof db,
	input: AdminUpdateCategoryInput
) {
	return database.transaction(async (tx) => {
		await lockCategoryIntegrity(tx)
		const nodes = await listAdminCategories(tx)
		const existing = nodes.find((node) => node.id === input.id)
		if (!existing) {
			throw new ORPCError('NOT_FOUND', { message: 'Category does not exist.' })
		}
		const parentId =
			input.parentId === undefined ? existing.parentId : input.parentId
		if (parentId === existing.id) {
			throw new ORPCError('BAD_REQUEST', {
				message: 'A category cannot be its own parent.',
			})
		}
		const subtree = nodes.filter(
			(node) =>
				node.id === existing.id || node.path.startsWith(`${existing.path}/`)
		)
		if (subtree.some((node) => node.id === parentId)) {
			throw new ORPCError('BAD_REQUEST', {
				message: 'A category cannot be moved under its own descendant.',
			})
		}
		const parent =
			parentId === existing.parentId
				? nodes.find((node) => node.id === parentId)
				: requireParent(nodes, parentId)
		const nextDepth = (parent?.depth ?? 0) + 1
		if (subtree.some((node) => node.depth - existing.depth + nextDepth > 3)) {
			throw new ORPCError('BAD_REQUEST', {
				message:
					'Moving this subtree would exceed the maximum depth of 3 levels.',
			})
		}
		const slug = input.slug ?? existing.slug
		const [slugOwner] = await tx
			.select({ id: category.id })
			.from(category)
			.where(eq(category.slug, slug))
		if (slugOwner && slugOwner.id !== existing.id) {
			throw new ORPCError('CONFLICT', {
				message: 'Category slug is already in use.',
			})
		}
		const nextPath = parent ? `${parent.path}/${slug}` : slug
		const paths: Array<OwnedPath> = []
		if (nextPath !== existing.path) {
			for (const node of subtree) {
				// Backfill old canonical paths for legacy categories without mappings.
				paths.push({ path: node.path, categoryId: node.id })
				paths.push({
					path: `${nextPath}${node.path.slice(existing.path.length)}`,
					categoryId: node.id,
				})
			}
			await checkPathOwnership(tx, nodes, paths)
		}
		await tx
			.update(category)
			.set({
				name: input.name ?? existing.name,
				slug,
				description: input.description ?? existing.description,
				parentId,
			})
			.where(eq(category.id, existing.id))
		if (paths.length > 0) {
			// Ownership was checked under the shared lock. Never overwrite history.
			await tx
				.insert(categoryPath)
				.values(paths)
				.onConflictDoNothing({ target: categoryPath.path })
		}
		return requireUpdatedNode(tx, existing.id)
	})
}

export async function removeAdminCategory(database: typeof db, id: string) {
	return database.transaction(async (tx) => {
		await lockCategoryIntegrity(tx)
		const detail = await getAdminCategoryById(tx, id)
		if (!detail) {
			throw new ORPCError('NOT_FOUND', { message: 'Category does not exist.' })
		}
		if (!detail.category.isLeaf) {
			throw new ORPCError('CONFLICT', {
				message:
					'Category has children. Move or remove its children before deleting it.',
			})
		}
		if (detail.category.directProjectCount > 0) {
			throw new ORPCError('CONFLICT', {
				message:
					'Category has direct project assignments, including unpublished projects. Reassign those projects before deleting it.',
			})
		}
		await tx.delete(category).where(eq(category.id, id))
		return { id }
	})
}
