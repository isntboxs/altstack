import { sql } from 'drizzle-orm'

import type { db } from '@altstack/db'
import { project } from '@altstack/db/schemas'

import type { CategoryNode } from '@altstack/shared/schemas/category'

// Only rooted paths within the public three-level contract are representable.
// The depth bound and visited IDs protect reads from malformed legacy/test
// data. Cyclic, orphaned, or over-depth nodes are omitted, without changing data.
const hierarchyCte = sql`
	WITH RECURSIVE category_hierarchy AS (
		SELECT id, parent_id, slug, name, description, slug::text AS path,
			1 AS depth, ARRAY[id] AS ancestry_ids
		FROM categories WHERE parent_id IS NULL
		UNION ALL
		SELECT child.id, child.parent_id, child.slug, child.name, child.description,
			parent.path || '/' || child.slug, parent.depth + 1,
			parent.ancestry_ids || child.id
		FROM categories child
		JOIN category_hierarchy parent ON child.parent_id = parent.id
		WHERE parent.depth < 3 AND NOT child.id = ANY(parent.ancestry_ids)
	)
`

// Unnest the ancestry once for all assignments, then deduplicate published
// projects at each ancestor (including the directly assigned category itself).
const nodesCtes = sql`${hierarchyCte}, category_project_counts AS (
	SELECT ancestor.id, count(DISTINCT assignment.project_id)::integer AS total
	FROM category_hierarchy descendant
	CROSS JOIN LATERAL unnest(descendant.ancestry_ids) ancestor(id)
	JOIN project_categories assignment ON assignment.category_id = descendant.id
	JOIN projects published ON published.id = assignment.project_id
		AND published.status = 'published'
	GROUP BY ancestor.id
), category_nodes AS (
	SELECT hierarchy.id, hierarchy.parent_id AS "parentId", hierarchy.slug,
		hierarchy.name, hierarchy.description, hierarchy.path, hierarchy.depth,
		NOT EXISTS (SELECT 1 FROM categories child WHERE child.parent_id = hierarchy.id)
			AS "isLeaf",
		coalesce(counts.total, 0) AS "projectCount"
	FROM category_hierarchy hierarchy
	LEFT JOIN category_project_counts counts ON counts.id = hierarchy.id
)
`

// C collation plus slug and ID makes sibling/name ordering deterministic across
// DB locales and equal display names. The flat public list is ordered by name.
const nodeOrder = sql`node.name COLLATE "C", node.slug COLLATE "C", node.id`

export async function listPublicCategories(database: typeof db) {
	const result = await database.execute<CategoryNode>(sql`
		${nodesCtes}
		SELECT node.* FROM category_nodes node
		WHERE node."projectCount" > 0 ORDER BY ${nodeOrder}
	`)
	return result.rows
}

export async function getCategoryByPath(database: typeof db, path: string) {
	const result = await database.execute<
		CategoryNode & { relationship: 'category' | 'ancestor' | 'child' }
	>(sql`
		${nodesCtes}, requested_category AS (
			SELECT * FROM category_hierarchy
			WHERE id = coalesce(
				(SELECT id FROM category_hierarchy WHERE path = ${path}),
				(SELECT category_id FROM category_paths WHERE path = ${path})
			)
		)
		SELECT node.*, CASE
			WHEN node.id = requested.id THEN 'category'
			WHEN node."parentId" = requested.id THEN 'child'
			ELSE 'ancestor' END AS relationship
		FROM category_nodes node
		JOIN requested_category requested ON node.id = ANY(requested.ancestry_ids)
			OR node."parentId" = requested.id
		ORDER BY ${nodeOrder}
	`)
	let category: CategoryNode | undefined
	const ancestors: Array<CategoryNode> = []
	const children: Array<CategoryNode> = []
	for (const { relationship, ...node } of result.rows) {
		if (relationship === 'category') category = node
		else if (relationship === 'ancestor') ancestors.push(node)
		else if (node.projectCount > 0) children.push(node)
	}
	if (!category) return undefined
	return {
		category,
		ancestors: ancestors.toSorted((a, b) => a.depth - b.depth),
		children,
	}
}

export async function getDirectProjectCategories(
	database: typeof db,
	projectId: string
) {
	const result = await database.execute<CategoryNode>(sql`
		${nodesCtes}
		SELECT node.* FROM category_nodes node
		JOIN project_categories assignment ON assignment.category_id = node.id
		WHERE assignment.project_id = ${projectId}
		ORDER BY ${nodeOrder}
	`)
	return result.rows
}

// Both search data and count receive this identical predicate. EXISTS keeps a
// project assigned to multiple descendants from multiplying search rows.
export function projectInCategorySubtree(slug: string) {
	return sql`EXISTS (
		${hierarchyCte}
		SELECT 1 FROM category_hierarchy descendant
		JOIN project_categories assignment ON assignment.category_id = descendant.id
		WHERE assignment.project_id = ${project.id}
		AND EXISTS (
			SELECT 1 FROM category_hierarchy ancestor
			WHERE ancestor.slug = ${slug} AND ancestor.id = ANY(descendant.ancestry_ids)
		)
	)`
}
