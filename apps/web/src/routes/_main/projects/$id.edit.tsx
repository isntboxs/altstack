import { IconArrowLeft } from '@tabler/icons-react'
import { createFileRoute, Link } from '@tanstack/react-router'

import { ProjectFormPending } from '#/components/workspace-skeletons'
import { EditProjectForm } from '#/features/admin-projects/components/edit-project-form'
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
			<div className="space-y-3">
				<Link
					to="/projects"
					className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
				>
					<IconArrowLeft className="size-4" />
					Projects
				</Link>

				<div className="space-y-1">
					<h1 className="text-xl font-semibold tracking-tight">Edit project</h1>
					<p className="text-sm text-muted-foreground">
						Edit project details. The preview updates as you type.
					</p>
				</div>
			</div>

			<EditProjectForm key={project.id} project={project} />
			<ProjectReviewHistory
				key={`history-${project.id}`}
				projectId={project.id}
			/>
		</div>
	)
}
