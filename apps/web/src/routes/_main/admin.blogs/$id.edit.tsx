import { createFileRoute } from '@tanstack/react-router'

import { ProjectPending, PublicError } from '#/components/public-page-state'
import { BlogEditor } from '#/features/admin-blogs/editor'
import { adminBlogQueries } from '#/features/blogs/queries'
export const Route = createFileRoute('/_main/admin/blogs/$id/edit')({
	loader: ({ context, params }) =>
		context.queryClient.query({
			...adminBlogQueries.byId(params.id),
			staleTime: 0,
		}),
	pendingMs: 250,
	pendingMinMs: 200,
	pendingComponent: ProjectPending,
	errorComponent: () => <PublicError title="Unable to load blog" />,
	component: Page,
})
/** Remounts the editor when its loaded revision changes after a reload. */
function Page() {
	const initial = Route.useLoaderData()
	return (
		<BlogEditor key={`${initial.id}:${initial.version}`} initial={initial} />
	)
}
