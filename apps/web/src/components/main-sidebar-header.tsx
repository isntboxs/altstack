import { IconPlus } from '@tabler/icons-react'
import { Link, useRouteContext } from '@tanstack/react-router'

import { env } from '@altstack/env/web'

import {
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarSeparator,
	useSidebar,
} from '@altstack/ui/components/sidebar'

import { BrandMark } from '#/components/brand-mark'

/** Keeps visible workspace branding and accessible names consistent in every sidebar mode. */
export function MainSidebarHeader() {
	const { auth } = useRouteContext({ from: '/_main' })
	const { isMobile, setOpenMobile } = useSidebar()
	const isAdmin = auth.user.role === 'admin'
	const workspaceLabel = isAdmin ? 'Admin workspace' : 'Your workspace'
	const workspaceName = `${env.VITE_APP_NAME} ${workspaceLabel}`
	const close = () => {
		if (isMobile) setOpenMobile(false)
	}
	return (
		<>
			<SidebarHeader>
				<SidebarMenu className="gap-2">
					<SidebarMenuItem>
						<SidebarMenuButton
							size="lg"
							className="group-data-[collapsible=icon]:justify-center"
							aria-label={workspaceName}
							tooltip={workspaceName}
							render={
								<Link to={isAdmin ? '/admin' : '/managed'} onClick={close} />
							}
						>
							<BrandMark className="size-6!" />
							<div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
								<span className="font-semibold lowercase">
									{env.VITE_APP_NAME}
								</span>
								<span className="text-xs text-muted-foreground">
									{workspaceLabel}
								</span>
							</div>
						</SidebarMenuButton>
					</SidebarMenuItem>
					<SidebarMenuItem>
						<SidebarMenuButton
							variant="outline"
							aria-label={isAdmin ? 'Create project' : 'Submit a project'}
							tooltip={isAdmin ? 'Create project' : 'Submit a project'}
							render={
								<Link
									to={isAdmin ? '/projects/create' : '/submit'}
									onClick={close}
								/>
							}
						>
							<IconPlus />
							<span className="group-data-[collapsible=icon]:hidden">
								{isAdmin ? 'Create project' : 'Submit a project'}
							</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarSeparator />
		</>
	)
}
