import type { AdminCategory } from '#/features/admin-categories/model'

export function categoryFixture(
	index: number,
	fields: Partial<AdminCategory> = {}
): AdminCategory {
	return {
		id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
		parentId: null,
		slug: `category-${index}`,
		name: `Category ${index}`,
		description: 'Original test description.',
		path: `category-${index}`,
		depth: 1,
		isLeaf: true,
		projectCount: 0,
		directProjectCount: 0,
		...fields,
	}
}

export const software = categoryFixture(1, {
	name: 'Software',
	slug: 'software',
	path: 'software',
	isLeaf: false,
})
export const editors = categoryFixture(2, {
	name: 'Editors',
	slug: 'editors',
	parentId: software.id,
	path: 'software/editors',
	depth: 2,
	isLeaf: false,
})
export const codeEditor = categoryFixture(3, {
	name: 'Code editor',
	slug: 'code-editor',
	parentId: editors.id,
	path: 'software/editors/code-editor',
	depth: 3,
})
export const textEditor = categoryFixture(4, {
	name: 'Text editor',
	slug: 'text-editor',
	parentId: editors.id,
	path: 'software/editors/text-editor',
	depth: 3,
})
export const flat = categoryFixture(5, {
	name: 'Flat leaf',
	slug: 'flat-leaf',
	path: 'flat-leaf',
})
export const assigned = categoryFixture(6, {
	name: 'Assigned',
	directProjectCount: 1,
})
export const categories = [
	software,
	editors,
	codeEditor,
	textEditor,
	flat,
	assigned,
]
