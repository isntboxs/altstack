import { describe, expect, it } from 'vite-plus/test'

import {
	categoryDeletionReason,
	categoryFormSchema,
	categoryLabel,
	categoryPathChanges,
	categoryPreviewPath,
	categoryUpdatePayload,
	eligibleParents,
} from '#/features/admin-categories/model'
import {
	assigned,
	categories,
	codeEditor,
	editors,
	flat,
	software,
	textEditor,
} from './fixtures/categories'

describe('category hierarchy editor', () => {
	it('excludes self, descendants, assigned parents, and depth that cannot fit the subtree', () => {
		expect(eligibleParents(categories, editors).map((node) => node.id)).toEqual(
			[software.id, flat.id]
		)
		expect(eligibleParents(categories, software)).toEqual([])
		expect(eligibleParents(categories).map((node) => node.id)).toEqual([
			software.id,
			editors.id,
			flat.id,
		])
	})
	it('retains the unchanged parent when a refreshed list reports assignments', () => {
		const changed = categories.map((node) =>
			node.id === software.id ? { ...node, directProjectCount: 1 } : node
		)
		expect(eligibleParents(changed, editors).map((node) => node.id)).toContain(
			software.id
		)
		expect(eligibleParents(changed).map((node) => node.id)).not.toContain(
			software.id
		)
	})
	it('allows a leaf to move under a level two category and supports root leaves', () => {
		expect(eligibleParents(categories, flat).map((node) => node.id)).toContain(
			editors.id
		)
		expect(
			eligibleParents(categories, codeEditor).map((node) => node.id)
		).not.toContain(textEditor.id)
	})
	it('previews canonical paths using the full parent path and normalized slug', () => {
		expect(categoryLabel(codeEditor, categories)).toBe(
			'Software / Editors / Code editor'
		)
		expect(
			categoryPreviewPath(
				{ slug: 'New Editor', parentId: editors.id },
				categories
			)
		).toBe('software/editors/new-editor')
		expect(
			categoryPreviewPath({ slug: 'Root tools', parentId: null }, categories)
		).toBe('root-tools')
	})
	it('shows rename/reparent effects for every descendant, without changing suffixes', () => {
		expect(categoryPathChanges(editors, 'flat-leaf/tools', categories)).toEqual(
			[
				{
					id: editors.id,
					name: 'Editors',
					previous: '/categories/software/editors',
					next: '/categories/flat-leaf/tools',
				},
				{
					id: codeEditor.id,
					name: 'Code editor',
					previous: '/categories/software/editors/code-editor',
					next: '/categories/flat-leaf/tools/code-editor',
				},
				{
					id: textEditor.id,
					name: 'Text editor',
					previous: '/categories/software/editors/text-editor',
					next: '/categories/flat-leaf/tools/text-editor',
				},
			]
		)
		expect(categoryPathChanges(editors, editors.path, categories)).toEqual([])
	})
	it('uses refreshed paths and hierarchy-relative suffixes after a concurrent rename', () => {
		const refreshed = categories.map((node) => {
			return {
				...node,
				path: node.path.replace('software/editors', 'software/writing-tools'),
			}
		})
		expect(
			categoryPathChanges(editors, 'flat-leaf/tools', refreshed)[1]
		).toEqual({
			id: codeEditor.id,
			name: codeEditor.name,
			previous: '/categories/software/writing-tools/code-editor',
			next: '/categories/flat-leaf/tools/code-editor',
		})
	})
	it('omits unchanged legacy null descriptions and submits only changed fields', () => {
		const legacy = { ...flat, description: null }
		expect(
			categoryUpdatePayload(legacy, {
				name: ' Renamed ',
				slug: flat.slug,
				parentId: null,
				description: '',
			})
		).toEqual({ id: flat.id, name: 'Renamed' })
		expect(
			categoryUpdatePayload(legacy, {
				name: flat.name,
				slug: flat.slug,
				parentId: editors.id,
				description: ' New copy ',
			})
		).toEqual({ id: flat.id, parentId: editors.id, description: 'New copy' })
	})
	it('rejects clearing existing copy, blank supplied copy, and overlong copy', () => {
		const values = {
			name: flat.name,
			slug: flat.slug,
			parentId: null,
			description: '',
		}
		expect(categoryFormSchema(flat).safeParse(values).success).toBe(false)
		expect(
			categoryFormSchema({ ...flat, description: null }).safeParse({
				...values,
				description: ' ',
			}).success
		).toBe(false)
		expect(
			categoryFormSchema().safeParse({
				...values,
				description: 'x'.repeat(301),
			}).success
		).toBe(false)
	})
	it('blocks deletion for children or assignments, including unpublished direct assignments', () => {
		expect(categoryDeletionReason(editors, categories)).toContain('children')
		expect(categoryDeletionReason(assigned, categories)).toContain('draft')
		expect(categoryDeletionReason(flat, categories)).toBe(null)
	})
})
