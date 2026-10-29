import { createFileRoute } from '@tanstack/react-router'

import { ProjectPending, PublicError } from '#/components/public-page-state'
import { CollectionEditor } from '#/features/admin-collections/editor'
import { adminCollectionQueries } from '#/features/collections/queries'
export const Route = createFileRoute('/_main/admin/collections/$id/edit')({
	loader: ({ context, params }) =>
		context.queryClient.query({
			...adminCollectionQueries.byId(params.id),
			staleTime: 0,
		}),
	pendingMs: 250,
	pendingMinMs: 200,
	pendingComponent: ProjectPending,
	errorComponent: () => <PublicError title="Unable to load collection" />,
	component: Page,
})
function Page() {
	const initial = Route.useLoaderData()
	return (
		<CollectionEditor
			key={`${initial.id}:${initial.version}`}
			initial={initial}
		/>
	)
}
