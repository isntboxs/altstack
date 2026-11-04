import { createFileRoute } from '@tanstack/react-router'

import { PublicError, PublicPending } from '#/components/public-page-state'
import { AboutEditor } from '#/features/about/editor'
import { aboutQueries } from '#/features/about/queries'

export const Route = createFileRoute('/_main/admin/about')({
	loader: ({ context }) =>
		context.queryClient.query({ ...aboutQueries.admin(), staleTime: 0 }),
	pendingMs: 250,
	pendingMinMs: 200,
	pendingComponent: PublicPending,
	errorComponent: () => <PublicError title="Unable to load About editor" />,
	component: Page,
})

function Page() {
	const initial = Route.useLoaderData()
	return <AboutEditor key={initial.version} initial={initial} />
}
