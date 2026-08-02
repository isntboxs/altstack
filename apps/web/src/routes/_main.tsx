import { createFileRoute, Outlet } from '@tanstack/react-router'

import { Header } from '#/components/header'

export const Route = createFileRoute('/_main')({
	component: RouteComponent,
})

function RouteComponent() {
	return (
		<>
			<Header />
			<main className="py-16">
				<Outlet />
			</main>
		</>
	)
}
