import { createFileRoute } from '@tanstack/react-router'

import { PublicError } from '#/components/public-page-state'
import { ProjectsPending } from '#/components/workspace-skeletons'
import { ProjectListPage } from '#/features/admin-projects/components/project-list-page'
import { adminProjectSearchSchema } from '#/features/admin-projects/search'

export const Route = createFileRoute('/_main/admin/submissions')({
	validateSearch: adminProjectSearchSchema,
	pendingMs: 250,
	pendingMinMs: 200,
	pendingComponent: ProjectsPending,
	errorComponent: () => <PublicError title="Unable to load submissions" />,
	component: Page,
})
function Page() {
	const search = Route.useSearch()
	const navigate = Route.useNavigate()
	return (
		<ProjectListPage
			submissions
			search={search}
			onSearchChange={(next) => void navigate({ search: next })}
		/>
	)
}
