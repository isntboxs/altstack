import { useTable } from '@tanstack/react-table'
import type {
	ColumnDef,
	RowData,
	SortingState,
	ColumnFiltersState,
	ColumnVisibilityState,
	OnChangeFn,
	PaginationState,
} from '@tanstack/react-table'
import { useTanStackTableDevtools } from '@tanstack/react-table-devtools'
import { useState } from 'react'

import { Button } from '@altstack/ui/components/button'
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from '@altstack/ui/components/dropdown-menu'
import { Input } from '@altstack/ui/components/input'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@altstack/ui/components/table'

import { features } from '#/utils/data-table-features'
import type { DataTableFeatures } from '#/utils/data-table-features'

interface DataTableProps<TData extends RowData & { id: string }> {
	columns: Array<ColumnDef<DataTableFeatures, TData>>
	data: Array<TData>
	rowCount: number
	pagination: PaginationState
	onPaginationChange: OnChangeFn<PaginationState>
	sorting: SortingState
	onSortingChange: OnChangeFn<SortingState>
	columnFilters: ColumnFiltersState
	onColumnFiltersChange: OnChangeFn<ColumnFiltersState>
}

export const AdminProjectDataTable = <TData extends RowData & { id: string }>({
	columns,
	data,
	rowCount,
	pagination,
	onPaginationChange,
	sorting,
	onSortingChange,
	columnFilters,
	onColumnFiltersChange,
}: DataTableProps<TData>) => {
	const [columnVisibility, setColumnVisibility] =
		useState<ColumnVisibilityState>({})
	const [rowSelection, setRowSelection] = useState({})

	const table = useTable({
		features,
		data,
		columns,
		// The parent fetches filtered, sorted pages and their total row count.
		manualPagination: true,
		manualFiltering: true,
		manualSorting: true,
		enableMultiSort: false,
		getRowId: (row) => row.id,
		rowCount,
		autoResetPageIndex: false,
		onSortingChange,
		onColumnFiltersChange,
		onColumnVisibilityChange: setColumnVisibility,
		onRowSelectionChange: setRowSelection,
		onPaginationChange,
		state: {
			sorting,
			columnFilters,
			columnVisibility,
			rowSelection,
			pagination,
		},
		key: 'submissions',
	})

	useTanStackTableDevtools(table)

	const nameColumn = table.getColumn('name')
	const nameFilter = nameColumn?.getFilterValue()

	return (
		<>
			<div className="flex items-center py-4">
				<Input
					placeholder="Filter names..."
					value={typeof nameFilter === 'string' ? nameFilter : ''}
					onChange={(event) => nameColumn?.setFilterValue(event.target.value)}
					className="max-w-sm"
				/>

				<DropdownMenu>
					<DropdownMenuTrigger
						render={<Button variant="outline" className="ml-auto" />}
					>
						Columns
					</DropdownMenuTrigger>

					<DropdownMenuContent align="end" className="w-36">
						{table
							.getAllColumns()
							.filter((column) => column.getCanHide())
							.map((column) => (
								<DropdownMenuCheckboxItem
									key={column.id}
									className="capitalize"
									checked={column.getIsVisible()}
									onCheckedChange={(value) => column.toggleVisibility(!!value)}
								>
									{column.id}
								</DropdownMenuCheckboxItem>
							))}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			<div className="overflow-hidden rounded-md border">
				<Table>
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map((header) => (
									<TableHead key={header.id}>
										{header.isPlaceholder ? null : (
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
								<TableRow
									key={row.id}
									data-state={row.getIsSelected() && 'selected'}
								>
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
									No results.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			<div className="flex items-center justify-end space-x-2 py-4">
				<div className="flex-1 text-sm text-muted-foreground">
					{table.getFilteredSelectedRowModel().rows.length} of{' '}
					{table.getRowCount()} row(s) selected.
				</div>

				<div className="text-sm text-muted-foreground">
					Page {table.state.pagination.pageIndex + 1} of {table.getPageCount()}
				</div>

				<Button
					variant="outline"
					size="sm"
					onClick={() => table.previousPage()}
					disabled={!table.getCanPreviousPage()}
				>
					Previous
				</Button>
				<Button
					variant="outline"
					size="sm"
					onClick={() => table.nextPage()}
					disabled={!table.getCanNextPage()}
				>
					Next
				</Button>
			</div>
		</>
	)
}
