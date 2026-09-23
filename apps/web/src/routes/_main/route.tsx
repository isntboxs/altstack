import {
	IconLayoutSidebarLeftCollapse,
	IconLayoutSidebarRightCollapse,
} from '@tabler/icons-react'
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { cn } from 'cn'

import { Button } from '@altstack/ui/components/button'
import {
	SidebarInset,
	SidebarProvider,
	useSidebar,
} from '@altstack/ui/components/sidebar'

import { MainSidebar } from '#/components/main-sidebar'

export const Route = createFileRoute('/_main')({
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
			<MainSidebar variant="floating" />

			<SidebarInset>
				<Wrapper>
					<Outlet />
				</Wrapper>
			</SidebarInset>
		</SidebarProvider>
	)
}

const Wrapper = ({ children }: { children: React.ReactNode }) => {
	const { state, isMobile, toggleSidebar } = useSidebar()

	return (
		<div
			className={cn(
				'relative h-svh overflow-auto rounded-lg bg-sidebar transition-all duration-300 ease-in-out md:h-[calc(100svh-1rem)]',
				!isMobile && state === 'expanded'
					? 'mx-0 my-2 ring-1 ring-sidebar-border'
					: 'my-2 ml-2 ring-1 ring-sidebar-border',
				isMobile && 'm-0 rounded-none'
			)}
		>
			<div className="sticky top-0 z-50 h-12 w-full bg-sidebar/90 backdrop-blur supports-backdrop-filter:bg-sidebar/60">
				<div className="flex h-full items-center justify-between px-4 py-2">
					<Button
						variant="outline"
						size="icon-sm"
						aria-label={
							state === 'collapsed' || isMobile
								? 'Expand sidebar'
								: 'Collapse sidebar'
						}
						onClick={toggleSidebar}
					>
						{state === 'collapsed' || isMobile ? (
							<IconLayoutSidebarRightCollapse />
						) : (
							<IconLayoutSidebarLeftCollapse />
						)}
					</Button>
				</div>
			</div>

			{children}
		</div>
	)
}
