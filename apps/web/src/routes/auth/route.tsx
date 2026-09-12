import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { z } from 'zod'

import { Header } from '#/components/header'
import { resolveReturnTo } from '#/utils/return-to'

const searchSchema = z.object({
	returnTo: z
		.string()
		.refine((v) => resolveReturnTo(v, '/'))
		.optional()
		.catch(undefined),
})

export const Route = createFileRoute('/auth')({
	validateSearch: z.compile(searchSchema),
	beforeLoad: ({ context: { auth } }) => {
		if (auth) {
			throw redirect({ to: '/', replace: true, viewTransition: true })
		}
	},
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
