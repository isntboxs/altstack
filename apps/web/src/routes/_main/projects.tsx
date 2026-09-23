import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_main/projects')({
	beforeLoad: ({ context: { auth } }) => {
		if (auth.user.role !== 'admin') {
			throw redirect({ to: '/', replace: true })
		}
	},
	component: Outlet,
})
