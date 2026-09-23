import { createFileRoute } from '@tanstack/react-router'

import { adminProjectColumns } from '#/features/admin-projects/components/admin-project-columns'
import { AdminProjectDataTable } from '#/features/admin-projects/components/admin-project-data-table'
import { useAdminProjectList } from '#/features/admin-projects/queries'

export const Route = createFileRoute('/_main/projects/')({
	component: RouteComponent,
})

function RouteComponent() {
	const { data } = useAdminProjectList()

	return (
		<div className="mx-auto w-full px-4">
			<AdminProjectDataTable
				columns={adminProjectColumns}
				data={data.projects}
			/>
		</div>
	)
}
