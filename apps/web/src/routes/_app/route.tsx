import { createFileRoute, Outlet } from '@tanstack/react-router'

import { Header } from '#/components/header'

export const Route = createFileRoute('/_app')({
	component: RouteComponent,
})

function RouteComponent() {
	const { auth } = Route.useRouteContext()
	return (
		<>
			<Header auth={auth} />

			<div className="pointer-events-none fixed inset-x-0 top-12 z-40 h-12 bg-linear-to-b from-background via-background/40 to-transparent" />

			<main>
				<Outlet />
			</main>
		</>
	)
}
