import { createFileRoute } from '@tanstack/react-router'
import type { PaginationState } from '@tanstack/react-table'
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
	const { data } = useAdminProjectList({
		page: pagination.pageIndex + 1,
		limit: pagination.pageSize,
	})

	return (
		<div className="mx-auto w-full px-4">
			<AdminProjectDataTable
				columns={adminProjectColumns}
				data={data.projects}
				rowCount={data.pagination.totalItems}
				pagination={pagination}
				onPaginationChange={setPagination}
			/>
		</div>
	)
}
