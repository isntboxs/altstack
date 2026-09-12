import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_panel')({
	beforeLoad: ({ context: { auth }, location }) => {
		if (!auth) {
			throw redirect({
				to: '/auth/sign-in',
				replace: true,
				viewTransition: true,
				search: { returnTo: location.pathname },
			})
		}
	},
	component: RouteComponent,
})

function RouteComponent() {
	return <Outlet />
}
