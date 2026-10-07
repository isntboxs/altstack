// @vitest-environment jsdom
import type * as RouterModule from '@tanstack/react-router'
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import { CategoryForm } from '#/features/admin-categories/components/category-form'
import { categories, flat, editors } from './fixtures/categories'

vi.mock('@tanstack/react-router', async () => {
	const actual = await vi.importActual<typeof RouterModule>(
		'@tanstack/react-router'
	)
	return {
		...actual,
		Link: ({ children }: { children?: React.ReactNode }) => (
			<a href="/admin/categories">{children}</a>
		),
		ClientOnly: ({ children }: { children?: React.ReactNode }) => (
			<>{children}</>
		),
	}
})

afterEach(cleanup)
function change(label: string, value: string) {
	fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

describe('category form', () => {
	it('suggests a normalized slug until the admin changes it manually', () => {
		render(
			<CategoryForm
				categories={categories}
				pending={false}
				onSubmit={vi.fn()}
			/>
		)
		change('Name', 'New Tools')
		expect(screen.getByLabelText('Slug')).toHaveProperty('value', 'new-tools')
		change('Slug', 'my-tools')
		change('Name', 'Different Tools')
		expect(screen.getByLabelText('Slug')).toHaveProperty('value', 'my-tools')
	})
	it('keeps the existing slug on a name edit and previews subtree moves', () => {
		render(
			<CategoryForm
				category={editors}
				categories={categories}
				pending={false}
				onSubmit={vi.fn()}
			/>
		)
		change('Name', 'Writing tools')
		expect(screen.getByLabelText('Slug')).toHaveProperty('value', 'editors')
		change('Parent', flat.id)
		change('Slug', 'writing')
		expect(screen.getByText('/categories/flat-leaf/writing')).toBeTruthy()
		expect(screen.getByText(/flat-leaf\/writing\/code-editor/)).toBeTruthy()
		expect(
			screen.getByText(/Old links will redirect to the new URL/)
		).toBeTruthy()
	})
	it('preserves edits and the original record after a server conflict and a cache refresh', async () => {
		const onSubmit = vi
			.fn()
			.mockRejectedValueOnce(new Error('Slug already exists'))
			.mockResolvedValueOnce(undefined)
		const { rerender } = render(
			<CategoryForm
				category={flat}
				categories={categories}
				pending={false}
				onSubmit={onSubmit}
			/>
		)
		change('Name', 'My edited leaf')
		fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
		await waitFor(() =>
			expect(screen.getByRole('alert').textContent).toContain(
				'Slug already exists'
			)
		)
		rerender(
			<CategoryForm
				category={{ ...flat, name: 'Concurrent name' }}
				categories={categories}
				pending={false}
				onSubmit={onSubmit}
			/>
		)
		expect(screen.getByLabelText('Name')).toHaveProperty(
			'value',
			'My edited leaf'
		)
		fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
		await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2))
		expect(onSubmit).toHaveBeenLastCalledWith(
			expect.objectContaining({ name: 'My edited leaf' }),
			flat
		)
	})
	it('allows an unchanged null description but displays field errors for cleared nonempty copy', async () => {
		const onSubmit = vi.fn()
		const { rerender } = render(
			<CategoryForm
				key="legacy"
				category={{ ...flat, description: null }}
				categories={categories}
				pending={false}
				onSubmit={onSubmit}
			/>
		)
		change('Name', 'Legacy renamed')
		fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
		await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
		rerender(
			<CategoryForm
				key="normal"
				category={flat}
				categories={categories}
				pending={false}
				onSubmit={onSubmit}
			/>
		)
		change('Description', '')
		fireEvent.blur(screen.getByLabelText('Description'))
		await waitFor(() =>
			expect(screen.getByLabelText('Description')).toHaveProperty(
				'ariaInvalid',
				'true'
			)
		)
		expect(screen.getByRole('button', { name: 'Save changes' })).toHaveProperty(
			'disabled',
			true
		)
	})
	it('disables submission and inputs while saving', () => {
		render(
			<CategoryForm
				category={flat}
				categories={categories}
				pending
				onSubmit={vi.fn()}
			/>
		)
		expect(screen.getByRole('button', { name: 'Saving…' })).toHaveProperty(
			'disabled',
			true
		)
		expect(screen.getByLabelText('Name').closest('fieldset')).toHaveProperty(
			'disabled',
			true
		)
	})
})
