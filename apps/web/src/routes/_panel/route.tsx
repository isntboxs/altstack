import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

import { SidebarInset, SidebarProvider } from '@altstack/ui/components/sidebar'

import { PanelSidebar } from '#/components/panel-sidebar'

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

		return { auth }
	},
	component: RouteComponent,
})

function RouteComponent() {
	return (
		<SidebarProvider>
			<PanelSidebar variant="floating" />

			<SidebarInset>
				<Outlet />
			</SidebarInset>
		</SidebarProvider>
	)
}
