import { createFileRoute } from '@tanstack/react-router'

import { PublicError } from '#/components/public-page-state'
import { ProjectsPending } from '#/components/workspace-skeletons'
import { adminProjectSearchSchema } from '#/features/admin-projects/search'
import { SubmissionInbox } from '#/features/admin-submissions/components/submission-inbox'

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
		<SubmissionInbox
			search={search}
			onSearchChange={(next) => void navigate({ search: next })}
		/>
	)
}
