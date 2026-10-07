// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { QueryKey } from '@tanstack/react-query'
import type * as RouterModule from '@tanstack/react-router'
import {
	act,
	cleanup,
	fireEvent,
	render,
	renderHook,
	screen,
	waitFor,
	within,
} from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { ORPCRouterClient } from '@altstack/api/routers'

import { CategoryCombobox } from '#/components/category-combobox'
import { ProjectCategoryBadges } from '#/components/project-category-badges'
import { CategoryTable } from '#/features/admin-categories/components/category-table'
import {
	adminCategoryQueries,
	useAdminCategoryCreate,
	useAdminCategoryDelete,
	useAdminCategoryUpdate,
} from '#/features/admin-categories/queries'
import {
	adminProjectQueries,
	useAdminProjectCreate,
	useAdminProjectDelete,
	useAdminProjectUpdate,
} from '#/features/admin-projects/queries'
import { categoryQueries } from '#/features/category/queries'
import { projectQueries } from '#/features/project/queries'
import { orpc, projectORPC } from '#/utils/orpc'
import {
	assigned,
	categoryFixture,
	categories,
	codeEditor,
	editors,
	flat,
	textEditor,
} from './fixtures/categories'

const { rpc, navigate, invalidate } = vi.hoisted(() => {
	return {
		rpc: vi.fn<(path: Array<string>, input: unknown) => Promise<unknown>>(),
		navigate: vi.fn().mockResolvedValue(undefined),
		invalidate: vi.fn().mockResolvedValue(undefined),
	}
})

vi.mock('@altstack/api/routers', () => {
	return { routers: {} }
})
vi.mock('@altstack/api/context', () => {
	return { createORPCContext: vi.fn() }
})
vi.mock('@tanstack/react-start/server', () => {
	return { getRequestHeaders: vi.fn() }
})
vi.mock('@altstack/env/web', () => {
	return {
		env: { VITE_SERVER_URL: 'http://localhost:3001' },
	}
})
vi.mock('@tanstack/react-start', async () => {
	const { createORPCClient } = await import('@orpc/client')
	const client: ORPCRouterClient = createORPCClient({ call: rpc })
	return {
		createIsomorphicFn: () => {
			return {
				server: () => {
					return { client: () => () => client }
				},
			}
		},
	}
})
vi.mock('@tanstack/react-router', async () => {
	const actual = await vi.importActual<typeof RouterModule>(
		'@tanstack/react-router'
	)
	return {
		...actual,
		useRouter: () => {
			return { navigate, invalidate }
		},
		Link: ({ children, to }: { children?: React.ReactNode; to: string }) => (
			<a href={to}>{children}</a>
		),
	}
})
vi.mock('@altstack/ui/components/toast', () => {
	return { toast: { add: vi.fn() } }
})

afterEach(cleanup)
beforeEach(() => {
	rpc
		.mockReset()
		.mockImplementation((path) =>
			Promise.resolve(path.at(-1) === 'list' ? { categories } : flat)
		)
	navigate.mockClear()
	invalidate.mockClear()
})

function provider(
	queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false, staleTime: Infinity },
			mutations: { retry: false },
		},
	})
) {
	return {
		queryClient,
		wrapper: ({ children }: { children: React.ReactNode }) => (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		),
	}
}

function Picker({ initial = [] }: { initial?: Array<string> }) {
	const [value, setValue] = useState(initial)
	return (
		<>
			<label htmlFor="categories">Categories</label>
			<CategoryCombobox
				id="categories"
				value={value}
				onValueChange={setValue}
			/>
			<div data-testid="preview">
				<ProjectCategoryBadges slugs={value} />
			</div>
			<output data-testid="selection">{value.join(',')}</output>
		</>
	)
}

describe('project leaf category selection', () => {
	it('searches ancestor names, hides branches and selects two sibling leaves', async () => {
		render(<Picker />, provider())
		const input = await screen.findByRole('combobox')
		fireEvent.focus(input)
		fireEvent.keyDown(input, { key: 'ArrowDown' })
		fireEvent.change(input, { target: { value: 'Software' } })
		await screen.findByRole('option', {
			name: 'Software / Editors / Code editor',
		})
		expect(screen.queryByRole('option', { name: 'Software / Editors' })).toBe(
			null
		)
		fireEvent.click(
			screen.getByRole('option', { name: 'Software / Editors / Code editor' })
		)
		fireEvent.keyDown(input, { key: 'ArrowDown' })
		fireEvent.change(input, { target: { value: 'text-editor' } })
		fireEvent.click(
			await screen.findByRole('option', {
				name: 'Software / Editors / Text editor',
			})
		)
		expect(screen.getByTestId('selection').textContent).toBe(
			'code-editor,text-editor'
		)
		expect(
			within(screen.getByTestId('preview')).getByText('Code editor')
		).toBeTruthy()
		expect(
			within(screen.getByTestId('preview')).getByText('Text editor')
		).toBeTruthy()
	})
	it('supports a flat root leaf, limits selection to three and allows removal', async () => {
		render(
			<Picker initial={[codeEditor.slug, textEditor.slug, flat.slug]} />,
			provider()
		)
		const input = await screen.findByRole('combobox')
		fireEvent.focus(input)
		fireEvent.keyDown(input, { key: 'ArrowDown' })
		fireEvent.change(input, { target: { value: 'Assigned' } })
		const option = await screen.findByRole('option', { name: 'Assigned' })
		expect(option).toHaveProperty('ariaDisabled', 'true')
		fireEvent.click(option)
		expect(screen.getByTestId('selection').textContent).toBe(
			'code-editor,text-editor,flat-leaf'
		)
		fireEvent.keyDown(input, { key: 'Escape' })
		fireEvent.blur(input)
		fireEvent.click(
			screen.getByRole('button', { name: 'Remove Flat leaf', hidden: true })
		)
		expect(screen.getByTestId('selection').textContent).toBe(
			'code-editor,text-editor'
		)
	})
	it('preserves stale saved selections and uses a slug fallback for unknown categories', async () => {
		render(<Picker initial={[editors.slug, 'unknown-category']} />, provider())
		await screen.findByText(/Some saved categories are unavailable/)
		expect(screen.getByTestId('selection').textContent).toBe(
			'editors,unknown-category'
		)
		expect(
			within(screen.getByTestId('preview')).getByText('unknown-category')
		).toBeTruthy()
	})
})

describe('category dashboard and delete confirmation', () => {
	it('shows empty categories, distinguishes both counts, and searches full ancestry', () => {
		render(<CategoryTable categories={categories} />, provider())
		expect(
			screen.getByRole('button', { name: 'Published projects ↕' })
		).toBeTruthy()
		expect(
			screen.getByRole('button', { name: 'Direct assignments ↕' })
		).toBeTruthy()
		fireEvent.change(
			screen.getByRole('textbox', { name: 'Search categories' }),
			{ target: { value: 'Software' } }
		)
		expect(
			screen.getByRole('button', { name: 'Delete Code editor' })
		).toBeTruthy()
		expect(screen.queryByRole('button', { name: 'Delete Flat leaf' })).toBe(
			null
		)
		fireEvent.change(
			screen.getByRole('textbox', { name: 'Search categories' }),
			{ target: { value: 'absent' } }
		)
		expect(screen.getByText('No categories match your search.')).toBeTruthy()
	})
	it('sorts counts and paginates locally, then resets the page when filtering', async () => {
		const many = Array.from({ length: 15 }, (_, index) =>
			categoryFixture(index + 20, {
				name: `Leaf ${String(index).padStart(2, '0')}`,
				directProjectCount: index,
			})
		)
		render(<CategoryTable categories={many} />, provider())
		expect(screen.getAllByRole('row')).toHaveLength(13)
		fireEvent.click(screen.getByRole('button', { name: 'Next' }))
		expect(screen.getByText('15 categories · Page 2 of 2')).toBeTruthy()
		expect(screen.getAllByRole('row')).toHaveLength(4)
		fireEvent.change(
			screen.getByRole('textbox', { name: 'Search categories' }),
			{ target: { value: 'Leaf' } }
		)
		expect(screen.getByText('15 categories · Page 1 of 2')).toBeTruthy()
		fireEvent.click(
			screen.getByRole('button', { name: 'Direct assignments ↕' })
		)
		fireEvent.click(
			screen.getByRole('button', { name: 'Direct assignments ↕' })
		)
		await waitFor(() =>
			expect(screen.getAllByRole('row')[1]?.textContent).toContain('Leaf 14')
		)
	})
	it('shows an empty-category state with an add action', () => {
		render(<CategoryTable categories={[]} />, provider())
		expect(
			screen.getByText('No categories yet. Add a category to get started.')
		).toBeTruthy()
		expect(screen.getByRole('link', { name: 'Add category' })).toBeTruthy()
	})
	it.each([
		['Editors', 'Remove children first.'],
		['Assigned', 'Move project assignments first (including draft projects).'],
	])(
		'blocks deletion of %s and explains what must move first',
		async (name, message) => {
			render(<CategoryTable categories={categories} />, provider())
			fireEvent.click(screen.getByRole('button', { name: `Delete ${name}` }))
			expect(await screen.findByRole('alertdialog')).toBeTruthy()
			expect(screen.getByText(message)).toBeTruthy()
			expect(
				screen.getByRole('button', { name: 'Delete category' })
			).toHaveProperty('disabled', true)
			expect(rpc).not.toHaveBeenCalled()
		}
	)
	it('keeps the dialog open after a delete race and supports retry', async () => {
		rpc
			.mockRejectedValueOnce(new Error('Category gained a project assignment'))
			.mockResolvedValueOnce({ id: flat.id })
		render(<CategoryTable categories={[flat]} />, provider())
		fireEvent.click(screen.getByRole('button', { name: 'Delete Flat leaf' }))
		fireEvent.click(
			await screen.findByRole('button', { name: 'Delete category' })
		)
		await waitFor(() =>
			expect(screen.getByRole('alert').textContent).toContain(
				'Category gained a project assignment'
			)
		)
		expect(screen.getByRole('alertdialog')).toBeTruthy()
		fireEvent.click(screen.getByRole('button', { name: 'Delete category' }))
		await waitFor(() => expect(screen.queryByRole('alertdialog')).toBe(null))
		expect(navigate).toHaveBeenCalledWith({
			to: '/admin/categories',
			replace: true,
		})
	})
})

const queryVariants = () => [
	adminCategoryQueries.list(),
	adminCategoryQueries.get({ id: editors.id }),
	categoryQueries.list(),
	categoryQueries.getByPath({ path: 'software/editors' }),
	categoryQueries.getByPath({ path: 'former/path' }),
	adminProjectQueries.list({ page: 2, name: 'demo' }),
	adminProjectQueries.get({ id: flat.id }),
	adminProjectQueries.listCategories(),
	projectQueries.listCategories(),
	projectQueries.bySlug('demo'),
	projectQueries.search({ q: 'demo', category: 'editors' }),
	orpc.admin.category.list.queryOptions({ input: {} }),
	orpc.project.search.queryOptions({ input: { q: 'demo' } }),
	projectORPC.search.queryOptions({ input: { page: 3 } }),
]

describe('CRUD cache callbacks with real oRPC query keys', () => {
	it.each([
		['category create', useAdminCategoryCreate],
		['category update', useAdminCategoryUpdate],
		['category delete', useAdminCategoryDelete],
		['project create', useAdminProjectCreate],
		['project update', useAdminProjectUpdate],
		['project delete', useAdminProjectDelete],
	])(
		'%s invalidates every category/project variant and leaves unrelated caches alone',
		async (_name, hook) => {
			const { wrapper, queryClient } = provider()
			const keys: Array<QueryKey> = queryVariants().map(
				(query) => query.queryKey
			)
			for (const key of keys) queryClient.setQueryData(key, { marker: true })
			queryClient.setQueryData(['unrelated'], { marker: true })
			const { result } = renderHook(
				() => {
					return { mutate: hook().mutateAsync }
				},
				{
					wrapper,
				}
			)
			const input = {
				id: flat.id,
				name: flat.name,
				slug: flat.slug,
				description: flat.description ?? 'Copy',
				parentId: null,
				categorySlugs: [flat.slug],
				tagline: 'Test',
				repositoryUrl: 'https://github.com/test/demo',
				logo: 'test-logo',
			}
			await act(async () => {
				await result.current.mutate(input)
			})
			const deletedProjectDetail =
				_name === 'project delete'
					? JSON.stringify(adminProjectQueries.get({ id: flat.id }).queryKey)
					: null
			for (const key of keys.filter(
				(candidateKey) => JSON.stringify(candidateKey) !== deletedProjectDetail
			)) {
				expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true)
			}
			expect(queryClient.getQueryState(['unrelated'])?.isInvalidated).toBe(
				false
			)
			expect(invalidate).toHaveBeenCalledTimes(1)
		}
	)
	it('removes all deleted category detail variants, including root utils', async () => {
		const { wrapper, queryClient } = provider()
		const keys = [
			adminCategoryQueries.get({ id: flat.id }).queryKey,
			orpc.admin.category.getById.queryOptions({ input: { id: flat.id } })
				.queryKey,
		]
		for (const key of keys) {
			queryClient.setQueryData(key, {
				category: flat,
				ancestors: [],
				children: [],
			})
		}
		queryClient.setQueryData(
			adminCategoryQueries.get({ id: editors.id }).queryKey,
			{ category: editors, ancestors: [], children: [] }
		)
		const { result } = renderHook(useAdminCategoryDelete, { wrapper })
		await act(async () => {
			await result.current.mutateAsync({ id: flat.id })
		})
		for (const key of keys) {
			expect(queryClient.getQueryData(key)).toBeUndefined()
		}
		expect(
			queryClient.getQueryData(
				adminCategoryQueries.get({ id: editors.id }).queryKey
			)
		).toBeTruthy()
	})
	it('a rejected category write leaves data cached and does not navigate', async () => {
		rpc.mockRejectedValueOnce(new Error('Conflict'))
		const { wrapper, queryClient } = provider()
		queryClient.setQueryData(adminCategoryQueries.list().queryKey, {
			categories,
		})
		const { result } = renderHook(useAdminCategoryUpdate, { wrapper })
		await act(async () => {
			await expect(
				result.current.mutateAsync({ id: assigned.id, name: 'Edited' })
			).rejects.toThrow('Conflict')
		})
		expect(
			queryClient.getQueryState(adminCategoryQueries.list().queryKey)
				?.isInvalidated
		).toBe(false)
		expect(navigate).not.toHaveBeenCalled()
	})
})
