import { createFileRoute } from '@tanstack/react-router'
import type {
	ColumnFiltersState,
	PaginationState,
	SortingState,
} from '@tanstack/react-table'
import { useState } from 'react'

import { adminProjectColumns } from '#/features/admin-projects/components/admin-project-columns'
import { AdminProjectDataTable } from '#/features/admin-projects/components/admin-project-data-table'
import { useAdminProjectList } from '#/features/admin-projects/queries'

export const Route = createFileRoute('/_main/projects/')({
	component: RouteComponent,
})

const PAGE_SIZE = 12

function RouteComponent() {
	const [pagination, setPagination] = useState<PaginationState>({
		pageIndex: 0,
		pageSize: PAGE_SIZE,
	})
	const [sorting, setSorting] = useState<SortingState>([
		{ id: 'name', desc: false },
	])
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
	const nameFilter = columnFilters.find((filter) => filter.id === 'name')?.value
	const { data } = useAdminProjectList({
		page: pagination.pageIndex + 1,
		limit: pagination.pageSize,
		name: typeof nameFilter === 'string' ? nameFilter : undefined,
		sort: sorting[0]?.id === 'name' ? 'name' : 'createdAt',
		order: sorting[0]?.desc === false ? 'asc' : 'desc',
	})

	return (
		<div className="mx-auto w-full px-4">
			<AdminProjectDataTable
				columns={adminProjectColumns}
				data={data.projects}
				rowCount={data.pagination.totalItems}
				pagination={pagination}
				onPaginationChange={setPagination}
				sorting={sorting}
				onSortingChange={(updater) => {
					setSorting(updater)
					setPagination((previous) => {
						return { ...previous, pageIndex: 0 }
					})
				}}
				columnFilters={columnFilters}
				onColumnFiltersChange={(updater) => {
					setColumnFilters(updater)
					setPagination((previous) => {
						return { ...previous, pageIndex: 0 }
					})
				}}
			/>
		</div>
	)
}
