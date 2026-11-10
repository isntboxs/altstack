import { createFileRoute, Link } from '@tanstack/react-router'

import { ProjectFormPending } from '#/components/workspace-skeletons'
import { EditProjectForm } from '#/features/admin-projects/components/edit-project-form'
import { ProjectFormHeader } from '#/features/admin-projects/components/project-form-header'
import { ProjectReviewHistory } from '#/features/admin-projects/components/project-review-history'
import {
	adminProjectQueries,
	useAdminProjectGet,
} from '#/features/admin-projects/queries'

export const Route = createFileRoute('/_main/projects/$id/edit')({
	loader: async ({ context, params }) => {
		await context.queryClient.query(adminProjectQueries.get({ id: params.id }))
	},
	pendingMs: 250,
	pendingMinMs: 200,
	pendingComponent: ProjectFormPending,
	component: RouteComponent,
})

function RouteComponent() {
	const params = Route.useParams()
	const { data: project } = useAdminProjectGet({ id: params.id })

	return (
		<div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6">
			<ProjectFormHeader
				title="Edit project"
				description="Edit project details. The preview updates as you type."
			/>

			<Link
				to="/managed/$id/members"
				params={{ id: project.id }}
				className="text-sm underline underline-offset-4"
			>
				Manage members
			</Link>
			<EditProjectForm key={project.id} project={project} />
			<ProjectReviewHistory
				key={`history-${project.id}`}
				projectId={project.id}
			/>
		</div>
	)
}
