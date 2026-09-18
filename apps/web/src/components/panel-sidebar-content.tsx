import { IconSend } from '@tabler/icons-react'
import { Link, linkOptions, useMatchRoute } from '@tanstack/react-router'
import type { ComponentProps, FC } from 'react'

import {
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from '@altstack/ui/components/sidebar'

type PanelSidebarContentProps = ComponentProps<typeof SidebarContent>

const navLinks = linkOptions([
	{
		to: '/my-submissions',
		icon: IconSend,
		label: 'My Submissions',
	},
])

export const PanelSidebarContent: FC<PanelSidebarContentProps> = ({
	...props
}) => {
	const matchRoute = useMatchRoute()
	const { isMobile, setOpenMobile } = useSidebar()

	return (
		<SidebarContent {...props}>
			<SidebarGroup>
				<SidebarGroupContent>
					<SidebarMenu>
						{navLinks.map((link) => {
							const isActiveRoute = !!matchRoute({ to: link.to })

							return (
								<SidebarMenuItem key={link.to}>
									<SidebarMenuButton
										render={
											<Link
												{...link}
												activeOptions={{ exact: true }}
												viewTransition={true}
												onClick={() => {
													if (isMobile) setOpenMobile(false)
												}}
											>
												<link.icon />
												<span>{link.label}</span>
											</Link>
										}
										isActive={isActiveRoute}
									/>
								</SidebarMenuItem>
							)
						})}
					</SidebarMenu>
				</SidebarGroupContent>
			</SidebarGroup>
		</SidebarContent>
	)
}
