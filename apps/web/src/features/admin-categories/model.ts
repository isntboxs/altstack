import { z } from 'zod'

import type { ORPCRouterOutputs } from '@altstack/api/routers'

import {
	adminCreateCategoryInputSchema,
	adminUpdateCategoryInputSchema,
} from '@altstack/shared/schemas/admin-category'
import { slugSchema } from '@altstack/shared/schemas/common'

export type AdminCategory =
	ORPCRouterOutputs['admin']['category']['list']['categories'][number]
export type CategoryFormValues = z.input<typeof adminCreateCategoryInputSchema>

export function categoryAncestry(
	category: AdminCategory,
	categories: Array<AdminCategory>
) {
	const chain = [category]
	const seen = new Set([category.id])
	let parentId = category.parentId
	while (parentId) {
		const parent = categories.find((node) => node.id === parentId)
		if (!parent || seen.has(parent.id)) break
		chain.unshift(parent)
		seen.add(parent.id)
		parentId = parent.parentId
	}
	return chain
}

export function categoryLabel(
	category: AdminCategory,
	categories: Array<AdminCategory>
) {
	return categoryAncestry(category, categories)
		.map((node) => node.name)
		.join(' / ')
}

export function categorySubtree(
	category: AdminCategory,
	categories: Array<AdminCategory>
) {
	const nodes = [{ category, height: 1, relativePath: '' }]
	const seen = new Set([category.id])
	for (const node of nodes) {
		for (const child of categories.filter(
			(item) => item.parentId === node.category.id
		)) {
			if (seen.has(child.id)) continue
			seen.add(child.id)
			nodes.push({
				category: child,
				height: node.height + 1,
				relativePath: `${node.relativePath}/${child.slug}`,
			})
		}
	}
	return nodes
}

export function eligibleParents(
	categories: Array<AdminCategory>,
	edited?: AdminCategory
) {
	const subtree = edited ? categorySubtree(edited, categories) : []
	const height = Math.max(1, ...subtree.map((node) => node.height))
	const excluded = new Set(subtree.map((node) => node.category.id))
	return categories.filter((candidate) => {
		if (excluded.has(candidate.id)) return false
		// Keep an unchanged relationship editable even when the fresh list has
		// changed since this record loaded. The server validates the final write.
		if (edited?.parentId === candidate.id) return true
		return candidate.directProjectCount === 0 && candidate.depth + height <= 3
	})
}

export function categoryPreviewPath(
	values: Pick<CategoryFormValues, 'slug' | 'parentId'>,
	categories: Array<AdminCategory>
) {
	const parsed = slugSchema.safeParse(values.slug)
	const slug = parsed.success ? parsed.data : 'your-slug'
	const parent = categories.find((node) => node.id === values.parentId)
	return parent ? `${parent.path}/${slug}` : slug
}

export function categoryPathChanges(
	edited: AdminCategory,
	nextPath: string,
	categories: Array<AdminCategory>
) {
	const current = categories.find((node) => node.id === edited.id) ?? edited
	if (current.path === nextPath) return []
	return categorySubtree(current, categories).map(
		({ category, relativePath }) => {
			return {
				id: category.id,
				name: category.name,
				previous: `/categories/${category.path}`,
				next: `/categories/${nextPath}${relativePath}`,
			}
		}
	)
}

export function categoryFormSchema(edited?: AdminCategory) {
	const description = adminCreateCategoryInputSchema.shape.description
	return adminCreateCategoryInputSchema.extend({
		description:
			edited?.description === null
				? description.or(z.literal(''))
				: description,
	})
}

export function categoryUpdatePayload(
	edited: AdminCategory,
	values: CategoryFormValues
) {
	const parsed = categoryFormSchema(edited).parse(values)
	return adminUpdateCategoryInputSchema.parse({
		id: edited.id,
		...(parsed.name !== edited.name ? { name: parsed.name } : {}),
		...(parsed.slug !== edited.slug ? { slug: parsed.slug } : {}),
		...(parsed.parentId !== edited.parentId
			? { parentId: parsed.parentId }
			: {}),
		...(parsed.description !== (edited.description ?? '')
			? { description: parsed.description }
			: {}),
	})
}

export function categoryDeletionReason(
	category: AdminCategory,
	categories: Array<AdminCategory>
) {
	const children = categories.some((node) => node.parentId === category.id)
	if (children && category.directProjectCount > 0) {
		return 'Remove children and move project assignments first.'
	}
	if (children) return 'Remove children first.'
	if (category.directProjectCount > 0) {
		return 'Move project assignments first (including draft projects).'
	}
	return null
}
