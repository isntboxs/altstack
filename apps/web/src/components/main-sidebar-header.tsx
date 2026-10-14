import {
	IconLayoutSidebarLeftCollapse,
	IconLayoutSidebarRightCollapse,
} from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'
import type { ComponentProps, FC } from 'react'

import { env } from '@altstack/env/web'

import {
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from '@altstack/ui/components/sidebar'

import { BrandMark } from '#/components/brand-mark'

type MainSidebarHeaderProps = ComponentProps<typeof SidebarHeader>

export const MainSidebarHeader: FC<MainSidebarHeaderProps> = ({ ...props }) => {
	const { isMobile, openMobile, state, toggleSidebar } = useSidebar()
	const isExpanded = isMobile ? openMobile : state === 'expanded'

	return (
		<SidebarHeader {...props}>
			<SidebarMenu className="flex-row justify-between">
				<SidebarMenuItem>
					<SidebarMenuButton
						className="mx-auto w-fit data-[slot=sidebar-menu-button]:p-2!"
						render={
							<Link to="." className="flex items-center gap-2" viewTransition>
								<BrandMark className="size-5!" />

								<h1 className="text-xl font-bold lowercase">
									{env.VITE_APP_NAME}
								</h1>
							</Link>
						}
					/>
				</SidebarMenuItem>

				<SidebarMenuItem>
					<SidebarMenuButton
						className="mx-auto w-fit data-[slot=sidebar-menu-button]:p-2!"
						aria-label={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
						onClick={toggleSidebar}
					>
						{isExpanded ? (
							<IconLayoutSidebarLeftCollapse />
						) : (
							<IconLayoutSidebarRightCollapse />
						)}
					</SidebarMenuButton>
				</SidebarMenuItem>
			</SidebarMenu>
		</SidebarHeader>
	)
}
