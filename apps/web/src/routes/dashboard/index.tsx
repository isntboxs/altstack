import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { orpc } from '#/utils/orpc'

export const Route = createFileRoute('/dashboard/')({
	loader: ({ context }) =>
		context.queryClient.ensureQueryData(orpc.health.queryOptions()),
	component: DashboardHome,
})

function DashboardHome() {
	const healthQuery = useSuspenseQuery(orpc.health.queryOptions())

	return (
		<div className="space-y-2">
			<h1 className="text-3xl font-medium">Dashboard</h1>
			<p className="text-base text-muted-foreground">
				healthy: {healthQuery.data.message}
			</p>
		</div>
	)
}
