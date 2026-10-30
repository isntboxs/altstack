import { createFileRoute } from '@tanstack/react-router'

import { AdminOverview } from '#/features/admin-dashboard/components/overview'

export const Route = createFileRoute('/_main/admin/')({
	component: Page,
})

function Page() {
	const { auth } = Route.useRouteContext()
	return <AdminOverview userId={auth.user.id} />
}
