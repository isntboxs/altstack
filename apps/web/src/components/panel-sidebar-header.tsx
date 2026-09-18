import {
	IconLayoutSidebarLeftCollapse,
	IconLayoutSidebarRightCollapse,
} from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'
import type { ComponentProps, FC } from 'react'
import { Layers, Layers2 } from 'reicon-react'

import { env } from '@altstack/env/web'

import {
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from '@altstack/ui/components/sidebar'

type PanelSidebarHeaderProps = ComponentProps<typeof SidebarHeader>

export const PanelSidebarHeader: FC<PanelSidebarHeaderProps> = ({
	...props
}) => {
	const { isMobile, openMobile, state, toggleSidebar } = useSidebar()
	const isExpanded = isMobile ? openMobile : state === 'expanded'

	return (
		<SidebarHeader {...props}>
			<SidebarMenu className="flex-row justify-between">
				<SidebarMenuItem>
					<SidebarMenuButton
						className="mx-auto w-fit data-[slot=sidebar-menu-button]:p-2!"
						render={
							<Link
								to="."
								className="group/logo flex items-center gap-2"
								viewTransition
							>
								<div className="flex size-fit items-center justify-center">
									<Layers className="size-5 rotate-0 opacity-100 transition-all duration-300 ease-in-out group-hover/logo:rotate-180 group-hover/logo:opacity-0" />
									<Layers2
										className="absolute size-5 -rotate-180 opacity-0 transition-all duration-300 ease-in-out group-hover/logo:rotate-0 group-hover/logo:opacity-100"
										weight="Filled"
									/>
								</div>

								<h1 className="text-xl font-bold">{env.VITE_APP_NAME}</h1>
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
