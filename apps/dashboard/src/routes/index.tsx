import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { orpc } from '#/utils/orpc'

export const Route = createFileRoute('/')({
	component: Home,
	loader: ({ context }) =>
		context.queryClient.ensureQueryData(orpc.health.queryOptions()),
})

function Home() {
	const healthQuery = useSuspenseQuery(orpc.health.queryOptions())

	return (
		<div className="p-8">
			<h1 className="text-4xl font-bold">Welcome to TanStack Start</h1>
			<p className="mt-4 text-lg">
				Edit <code>src/routes/index.tsx</code> to get started.
			</p>

			<div>healthy: {healthQuery.data.message}</div>
		</div>
	)
}
