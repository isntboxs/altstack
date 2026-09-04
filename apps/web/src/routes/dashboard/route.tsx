import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard')({
	beforeLoad: ({ context }) => {
		if (!context.auth) {
			throw redirect({ to: '/' })
		}

		return { auth: context.auth }
	},
	component: DashboardLayout,
})

function DashboardLayout() {
	return (
		<div className="container mx-auto w-full max-w-6xl px-6 pt-24 pb-10 lg:px-16">
			<Outlet />
		</div>
	)
}
