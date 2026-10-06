import { Link } from '@tanstack/react-router'
import { createColumnHelper, useTable } from '@tanstack/react-table'
import type {
	ColumnFiltersState,
	PaginationState,
	SortingState,
} from '@tanstack/react-table'
import { useState } from 'react'

import { Button } from '@altstack/ui/components/button'
import { Input } from '@altstack/ui/components/input'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@altstack/ui/components/table'

import { CategoryActions } from '#/features/admin-categories/components/category-actions'
import { categoryLabel } from '#/features/admin-categories/model'
import type { AdminCategory } from '#/features/admin-categories/model'
import { features } from '#/utils/data-table-features'
import type { DataTableFeatures } from '#/utils/data-table-features'

const helper = createColumnHelper<DataTableFeatures, AdminCategory>()

export function CategoryTable({
	categories,
}: {
	categories: Array<AdminCategory>
}) {
	const [sorting, setSorting] = useState<SortingState>([
		{ id: 'name', desc: false },
	])
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
	const [pagination, setPagination] = useState<PaginationState>({
		pageIndex: 0,
		pageSize: 12,
	})
	const columns = helper.columns([
		helper.accessor('name', {
			header: ({ column }) => (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
				>
					Name ↕
				</Button>
			),
			filterFn: (row, _id, value: unknown) =>
				typeof value !== 'string' ||
				`${categoryLabel(row.original, categories)} ${row.original.slug}`
					.toLowerCase()
					.includes(value.trim().toLowerCase()),
			cell: ({ row }) => (
				<div className="max-w-64 min-w-40 whitespace-normal">
					<p className="font-medium">{row.original.name}</p>
					<p className="text-xs text-muted-foreground">
						{categoryLabel(row.original, categories)}
					</p>
				</div>
			),
		}),
		helper.accessor('slug', {
			header: 'Slug',
			cell: ({ row }) => (
				<span className="font-mono text-xs">{row.original.slug}</span>
			),
		}),
		helper.accessor(
			(node) => {
				const parent = categories.find((item) => item.id === node.parentId)
				return parent ? categoryLabel(parent, categories) : 'Root'
			},
			{
				id: 'parent',
				header: 'Parent',
				cell: ({ getValue }) => (
					<p className="max-w-48 min-w-32 whitespace-normal">{getValue()}</p>
				),
			}
		),
		helper.accessor('depth', {
			header: ({ column }) => (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
				>
					Depth ↕
				</Button>
			),
		}),
		helper.accessor('projectCount', {
			header: ({ column }) => (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
				>
					Published projects ↕
				</Button>
			),
		}),
		helper.accessor('directProjectCount', {
			header: ({ column }) => (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
				>
					Direct assignments ↕
				</Button>
			),
		}),
		helper.display({
			id: 'actions',
			header: 'Actions',
			cell: ({ row }) => (
				<CategoryActions category={row.original} categories={categories} />
			),
		}),
	])
	const table = useTable({
		features,
		data: categories,
		columns,
		getRowId: (row) => row.id,
		enableMultiSort: false,
		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		onPaginationChange: setPagination,
		state: { sorting, columnFilters, pagination },
		key: 'admin-categories',
	})
	const filterValue = table.getColumn('name')?.getFilterValue()
	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<Input
					aria-label="Search categories"
					placeholder="Search names, ancestors or slugs…"
					className="max-w-sm"
					value={typeof filterValue === 'string' ? filterValue : ''}
					onChange={(event) => {
						table.getColumn('name')?.setFilterValue(event.target.value)
						table.setPageIndex(0)
					}}
				/>
				<Button
					nativeButton={false}
					render={<Link to="/admin/categories/create" />}
				>
					Add category
				</Button>
			</div>
			<p className="text-xs text-muted-foreground">
				Published projects counts distinct published projects across each
				subtree. Direct assignments includes all statuses assigned directly to
				the category.
			</p>
			<div className="overflow-hidden rounded-md border">
				<Table>
					<TableHeader>
						{table.getHeaderGroups().map((group) => (
							<TableRow key={group.id}>
								{group.headers.map((header) => (
									<TableHead key={header.id}>
										{!header.isPlaceholder && (
											<table.FlexRender header={header} />
										)}
									</TableHead>
								))}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{table.getRowModel().rows.length > 0 ? (
							table.getRowModel().rows.map((row) => (
								<TableRow key={row.id}>
									{row.getVisibleCells().map((cell) => (
										<TableCell key={cell.id}>
											<table.FlexRender cell={cell} />
										</TableCell>
									))}
								</TableRow>
							))
						) : (
							<TableRow>
								<TableCell
									colSpan={columns.length}
									className="h-24 text-center"
								>
									{categories.length > 0
										? 'No categories match your search.'
										: 'No categories yet. Add a category to get started.'}
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>
			<div className="flex flex-wrap items-center justify-end gap-2 text-sm">
				<p className="mr-auto text-muted-foreground">
					{table.getFilteredRowModel().rows.length} categories · Page{' '}
					{pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}
				</p>
				<Button
					size="sm"
					variant="outline"
					disabled={!table.getCanPreviousPage()}
					onClick={() => table.previousPage()}
				>
					Previous
				</Button>
				<Button
					size="sm"
					variant="outline"
					disabled={!table.getCanNextPage()}
					onClick={() => table.nextPage()}
				>
					Next
				</Button>
			</div>
		</div>
	)
}
