// @vitest-environment jsdom
import { createColumnHelper } from '@tanstack/react-table'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { AdminProjectDataTable } from '#/features/admin-projects/components/admin-project-data-table'
import { Route } from '#/routes/_main/projects/index'
import type { DataTableFeatures } from '#/utils/data-table-features'

const { queryInput } = vi.hoisted(() => {
	return { queryInput: vi.fn() }
})

vi.mock('@tanstack/react-table-devtools', () => {
	return {
		useTanStackTableDevtools: vi.fn(),
	}
})

vi.mock('#/features/admin-projects/queries', () => {
	return {
		useAdminProjectList: (input: unknown) => {
			queryInput(input)
			return {
				data: {
					projects: [{ id: 'alpha', name: 'Alpha' }],
					pagination: { totalItems: 24 },
				},
			}
		},
	}
})

vi.mock(
	'#/features/admin-projects/components/admin-project-columns',
	async () => {
		const tableModule = await import('@tanstack/react-table')
		const mockColumnHelper = tableModule.createColumnHelper<
			DataTableFeatures,
			{ id: string; name: string }
		>()
		return {
			adminProjectColumns: mockColumnHelper.columns([
				mockColumnHelper.accessor('name', {
					header: ({ column }) => (
						<button
							onClick={() =>
								column.toggleSorting(column.getIsSorted() === 'asc')
							}
						>
							Name
						</button>
					),
				}),
			]),
		}
	}
)

afterEach(cleanup)
beforeEach(() => queryInput.mockClear())

const helper = createColumnHelper<
	DataTableFeatures,
	{ id: string; name: string }
>()
const columns = helper.columns([
	helper.display({
		id: 'select',
		cell: ({ row }) => (
			<input
				type="checkbox"
				aria-label={`Select ${row.original.name}`}
				checked={row.getIsSelected()}
				onChange={(event) => row.toggleSelected(event.target.checked)}
			/>
		),
	}),
	helper.accessor('name', { header: 'Name' }),
])

describe('admin project data table', () => {
	it('keeps selection attached to the same project across pages and filters', () => {
		const props = {
			columns,
			rowCount: 2,
			pagination: { pageIndex: 0, pageSize: 1 },
			onPaginationChange: vi.fn(),
			sorting: [{ id: 'name', desc: false }],
			onSortingChange: vi.fn(),
			columnFilters: [],
			onColumnFiltersChange: vi.fn(),
		}
		const firstPage = [{ id: 'alpha', name: 'Alpha' }]
		const { rerender } = render(
			<AdminProjectDataTable {...props} data={firstPage} />
		)
		expect(
			screen.getByText('0 row(s) selected. 2 row(s) match current filters.')
		).toBeTruthy()
		fireEvent.click(screen.getByRole('checkbox', { name: 'Select Alpha' }))
		expect(
			screen.getByRole('checkbox', { name: 'Select Alpha' })
		).toHaveProperty('checked', true)
		expect(
			screen.getByText('1 row(s) selected. 2 row(s) match current filters.')
		).toBeTruthy()

		rerender(
			<AdminProjectDataTable
				{...props}
				pagination={{ pageIndex: 1, pageSize: 1 }}
				data={[{ id: 'beta', name: 'Beta' }]}
			/>
		)
		expect(
			screen.getByRole('checkbox', { name: 'Select Beta' })
		).toHaveProperty('checked', false)
		expect(
			screen.getByText('1 row(s) selected. 2 row(s) match current filters.')
		).toBeTruthy()
		fireEvent.click(screen.getByRole('checkbox', { name: 'Select Beta' }))
		expect(
			screen.getByText('2 row(s) selected. 2 row(s) match current filters.')
		).toBeTruthy()

		rerender(
			<AdminProjectDataTable
				{...props}
				data={firstPage}
				rowCount={1}
				columnFilters={[{ id: 'name', value: 'Alpha' }]}
			/>
		)
		expect(
			screen.getByText('2 row(s) selected. 1 row(s) match current filters.')
		).toBeTruthy()
		expect(
			screen.getByRole('checkbox', { name: 'Select Alpha' })
		).toHaveProperty('checked', true)

		rerender(
			<AdminProjectDataTable
				{...props}
				data={[]}
				rowCount={0}
				columnFilters={[{ id: 'name', value: 'unmatched' }]}
			/>
		)
		expect(
			screen.getByText('2 row(s) selected. 0 row(s) match current filters.')
		).toBeTruthy()

		rerender(<AdminProjectDataTable {...props} data={firstPage} />)
		expect(
			screen.getByRole('checkbox', { name: 'Select Alpha' })
		).toHaveProperty('checked', true)
		expect(
			screen.getByText('2 row(s) selected. 2 row(s) match current filters.')
		).toBeTruthy()
		fireEvent.click(screen.getByRole('checkbox', { name: 'Select Alpha' }))
		expect(
			screen.getByText('1 row(s) selected. 2 row(s) match current filters.')
		).toBeTruthy()
	})

	it('renders the server page without applying local filters or sorting', () => {
		render(
			<AdminProjectDataTable
				columns={columns}
				data={[
					{ id: 'zulu', name: 'Zulu' },
					{ id: 'alpha', name: 'Alpha' },
				]}
				rowCount={2}
				pagination={{ pageIndex: 0, pageSize: 12 }}
				onPaginationChange={vi.fn()}
				sorting={[{ id: 'name', desc: false }]}
				onSortingChange={vi.fn()}
				columnFilters={[{ id: 'name', value: 'unmatched' }]}
				onColumnFiltersChange={vi.fn()}
			/>
		)
		expect(
			screen
				.getAllByRole('row')
				.slice(1)
				.map((row) => row.textContent)
		).toEqual(['Zulu', 'Alpha'])
	})

	it('sends the active controls to the API and resets pagination on changes', () => {
		const Component = Route.options.component
		if (!Component) throw new Error('Missing projects route component')
		render(<Component />)
		expect(queryInput).toHaveBeenLastCalledWith({
			page: 1,
			limit: 12,
			name: undefined,
			sort: 'name',
			order: 'asc',
		})
		fireEvent.click(screen.getByRole('button', { name: 'Next' }))
		expect(queryInput).toHaveBeenLastCalledWith(
			expect.objectContaining({ page: 2 })
		)

		fireEvent.click(screen.getByRole('button', { name: 'Name' }))
		expect(queryInput).toHaveBeenLastCalledWith(
			expect.objectContaining({ page: 1, sort: 'name', order: 'desc' })
		)

		fireEvent.click(screen.getByRole('button', { name: 'Next' }))
		fireEvent.change(screen.getByPlaceholderText('Filter names...'), {
			target: { value: 'Alpha' },
		})
		expect(queryInput).toHaveBeenLastCalledWith(
			expect.objectContaining({ page: 1, name: 'Alpha', order: 'desc' })
		)
	})
})
