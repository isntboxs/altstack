import { IconPlus } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'
import type {
	ColumnFiltersState,
	PaginationState,
	SortingState,
} from '@tanstack/react-table'

import { PROJECT_STATUS } from '@altstack/shared/constants'

import { buttonVariants } from '@altstack/ui/components/button'

import { AdminPageHeader } from '#/features/admin-dashboard/components/dashboard-state'
import { adminProjectColumns } from '#/features/admin-projects/components/admin-project-columns'
import { AdminProjectDataTable } from '#/features/admin-projects/components/admin-project-data-table'
import { useAdminProjectList } from '#/features/admin-projects/queries'
import type { AdminProjectSearch } from '#/features/admin-projects/search'

export function ProjectListPage({
	search,
	onSearchChange,
	submissions = false,
}: {
	search: AdminProjectSearch
	onSearchChange: (search: AdminProjectSearch) => void
	submissions?: boolean
}) {
	const status = submissions ? 'needsReview' : search.status
	const pagination: PaginationState = {
		pageIndex: (search.page ?? 1) - 1,
		pageSize: 12,
	}
	const sorting: SortingState = [
		{ id: search.sort ?? 'createdAt', desc: search.order !== 'asc' },
	]
	const columnFilters: ColumnFiltersState = [
		...(search.name ? [{ id: 'name', value: search.name }] : []),
		...(status ? [{ id: 'status', value: status }] : []),
	]
	const { data } = useAdminProjectList({
		page: search.page ?? 1,
		limit: 12,
		name: search.name,
		status: PROJECT_STATUS.find((value) => value === status),
		needsReview: status === 'needsReview' ? true : undefined,
		sort: search.sort ?? 'createdAt',
		order: search.order ?? 'desc',
	})
	return (
		<div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4 p-4 md:p-8">
			<AdminPageHeader
				title={submissions ? 'Submissions' : 'All projects'}
				description={
					submissions
						? 'Community submissions awaiting review. Open a project to check its content, publish it, or reject it with feedback.'
						: 'Search and manage every project in the catalog, including unpublished drafts.'
				}
			>
				{submissions && (
					<Link
						to="/projects"
						className={buttonVariants({ variant: 'outline' })}
					>
						All projects
					</Link>
				)}
				<Link to="/projects/create" className={buttonVariants({})}>
					<IconPlus data-icon="inline-start" />
					Create project
				</Link>
			</AdminPageHeader>
			<AdminProjectDataTable
				columns={adminProjectColumns}
				data={data.projects}
				rowCount={data.pagination.totalItems}
				pagination={pagination}
				onPaginationChange={(updater) => {
					const next =
						typeof updater === 'function' ? updater(pagination) : updater
					onSearchChange({ ...search, page: next.pageIndex + 1 })
				}}
				sorting={sorting}
				onSortingChange={(updater) => {
					const next =
						typeof updater === 'function' ? updater(sorting) : updater
					onSearchChange({
						...search,
						page: 1,
						sort: next[0]?.id === 'name' ? 'name' : 'createdAt',
						order: next[0]?.desc === false ? 'asc' : 'desc',
					})
				}}
				columnFilters={columnFilters}
				onColumnFiltersChange={(updater) => {
					const next =
						typeof updater === 'function' ? updater(columnFilters) : updater
					const name = next.find((filter) => filter.id === 'name')?.value
					const value = next.find((filter) => filter.id === 'status')?.value
					onSearchChange({
						...search,
						page: 1,
						name: typeof name === 'string' ? name : undefined,
						status:
							value === 'needsReview'
								? 'needsReview'
								: PROJECT_STATUS.find((item) => item === value),
					})
				}}
				hideStatusFilter={submissions}
			/>
		</div>
	)
}
