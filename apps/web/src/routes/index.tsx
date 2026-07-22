import { createFileRoute } from '@tanstack/react-router'

import { Button } from '@altstack/ui/components/button'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
	return (
		<div className="p-8">
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
		</div>
	)
}
