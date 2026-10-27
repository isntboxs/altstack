import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { cn } from 'cn'

import {
	SidebarInset,
	SidebarProvider,
	useSidebar,
} from '@altstack/ui/components/sidebar'

import { MainSidebar } from '#/components/main-sidebar'
import { WorkspaceHeader } from '#/components/workspace-header'
import { seoHead } from '#/features/seo/meta'

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
	head: () =>
		seoHead({
			title: 'Your workspace | AltStack',
			description: 'Manage your AltStack workspace.',
			noindex: true,
		}),
	component: RouteComponent,
})

function RouteComponent() {
	return (
		<SidebarProvider>
			<MainSidebar variant="floating" />

			<SidebarInset className="min-w-0">
				<Wrapper>
					<Outlet />
				</Wrapper>
			</SidebarInset>
		</SidebarProvider>
	)
}

const Wrapper = ({ children }: { children: React.ReactNode }) => {
	const { state, isMobile } = useSidebar()

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
			<a
				href="#workspace-content"
				className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-16 focus:z-30 focus:rounded-md focus:bg-background focus:p-2"
			>
				Skip to content
			</a>
			<WorkspaceHeader />

			<div id="workspace-content" tabIndex={-1}>
				{children}
			</div>
		</div>
	)
}
