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

export function MainSidebarHeader() {
	const { auth } = useRouteContext({ from: '/_main' })
	const { isMobile, setOpenMobile } = useSidebar()
	const isAdmin = auth.user.role === 'admin'
	const close = () => {
		if (isMobile) setOpenMobile(false)
	}
	return (
		<>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							size="lg"
							tooltip="AltStack workspace"
							render={
								<Link to={isAdmin ? '/admin' : '/managed'} onClick={close} />
							}
						>
							<BrandMark />
							<div className="flex flex-col">
								<span className="font-semibold lowercase">
									{env.VITE_APP_NAME}
								</span>
								<span className="text-xs text-muted-foreground">
									{isAdmin ? 'Admin workspace' : 'Your workspace'}
								</span>
							</div>
						</SidebarMenuButton>
					</SidebarMenuItem>
					<SidebarMenuItem>
						<SidebarMenuButton
							variant="outline"
							tooltip={isAdmin ? 'Create project' : 'Submit a project'}
							render={
								<Link
									to={isAdmin ? '/projects/create' : '/submit'}
									onClick={close}
								/>
							}
						>
							<IconPlus />
							<span>{isAdmin ? 'Create project' : 'Submit a project'}</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarSeparator />
		</>
	)
}
