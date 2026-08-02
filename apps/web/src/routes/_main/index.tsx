import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { Button } from '@altstack/ui/components/button'

import { orpc } from '#/utils/orpc'

export const Route = createFileRoute('/_main/')({
	component: Home,
	loader: ({ context }) =>
		context.queryClient.ensureQueryData(orpc.health.queryOptions()),
})

function Home() {
	const healthQuery = useSuspenseQuery(orpc.health.queryOptions())

	return (
		<div>
			<h1 className="text-4xl font-bold">Welcome to TanStack Start</h1>

			<p className="mt-4 text-lg">
				Edit <code>src/routes/index.tsx</code> to get started.
			</p>

			<div className="flex items-center gap-x-4 p-2">
				<Button>Default</Button>
				<Button variant="outline">Outline</Button>
				<Button variant="destructive">Destructive</Button>
				<Button variant="link">Link</Button>
			</div>

			<div>healthy: {healthQuery.data.message}</div>
		</div>
	)
}
