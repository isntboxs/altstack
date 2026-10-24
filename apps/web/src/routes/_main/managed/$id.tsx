import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'

import { PublicError } from '#/components/public-page-state'
import { MemberProjectEditor } from '#/features/project/components/member-project-editor'
import { ownershipQueries } from '#/features/project/ownership'
import { seoHead } from '#/features/seo/meta'

export const Route = createFileRoute('/_main/managed/$id')({
	loader: async ({ context, params }) => {
		await Promise.all([
			context.queryClient.query(
				ownershipQueries.project(context.auth.user.id, params.id)
			),
			context.queryClient.query(
				ownershipQueries.categories(context.auth.user.id, params.id)
			),
		])
	},
	head: () =>
		seoHead({
			title: 'Manage project | AltStack',
			description: 'Edit your verified project listing.',
			noindex: true,
		}),
	errorComponent: () => (
		<PublicError title="Project unavailable or access not granted" />
	),
	component: ManagedProject,
})
function ManagedProject() {
	const { auth } = Route.useRouteContext()
	const { id } = Route.useParams()
	const { data } = useSuspenseQuery(ownershipQueries.project(auth.user.id, id))
	const categories = useSuspenseQuery(
		ownershipQueries.categories(auth.user.id, id)
	).data.categories
	return (
		<main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 md:p-8">
			<Link to="/managed" className="text-sm underline underline-offset-4">
				My projects
			</Link>
			<header className="flex flex-col gap-2">
				<h1 className="text-2xl font-semibold">Edit {data.name}</h1>
				<p className="text-sm text-muted-foreground">
					Your changes publish immediately. The project repository and listing
					address stay tied to this verified project.
				</p>
				<Link
					to="/$slug"
					params={{ slug: data.slug }}
					className="text-sm underline underline-offset-4"
				>
					View public listing
				</Link>
			</header>
			<MemberProjectEditor
				key={data.revision}
				project={data}
				categories={categories}
			/>
		</main>
	)
}
