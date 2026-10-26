import { createFileRoute, Link } from '@tanstack/react-router'

import { PublicError } from '#/components/public-page-state'
import { ProjectMembers } from '#/features/project/components/project-members'
import { ownershipQueries } from '#/features/project/ownership'
import { seoHead } from '#/features/seo/meta'

export const Route = createFileRoute('/_main/managed/$id_/members')({
	loader: async ({ context, params }) => {
		await context.queryClient.query(
			ownershipQueries.members(context.auth.user.id, params.id)
		)
	},
	head: () =>
		seoHead({
			title: 'Project members | AltStack',
			description: 'Manage project membership.',
			noindex: true,
		}),
	errorComponent: () => (
		<PublicError title="Members unavailable or access not granted" />
	),
	component: MembersPage,
})
function MembersPage() {
	const { auth } = Route.useRouteContext()
	const { id } = Route.useParams()
	return (
		<main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 md:p-8">
			<Link to="/managed" className="text-sm underline underline-offset-4">
				My projects
			</Link>
			<h1 className="text-2xl font-semibold">Manage members</h1>
			<ProjectMembers id={id} userId={auth.user.id} />
		</main>
	)
}
