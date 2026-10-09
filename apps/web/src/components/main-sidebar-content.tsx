import { IconPackage, IconCategory, IconInbox } from '@tabler/icons-react'
import {
	Link,
	linkOptions,
	useMatchRoute,
	useRouteContext,
} from '@tanstack/react-router'
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

type MainSidebarContentProps = ComponentProps<typeof SidebarContent>

const navLinks = linkOptions([
	{
		to: '/projects',
		icon: IconPackage,
		label: 'Projects',
	},
	{ to: '/admin/categories', icon: IconCategory, label: 'Categories' },
])

const userNavLinks = linkOptions([
	{ to: '/submission', icon: IconInbox, label: 'Submission' },
])

export const MainSidebarContent: FC<MainSidebarContentProps> = ({
	...props
}) => {
	const matchRoute = useMatchRoute()
	const { auth } = useRouteContext({ from: '/_main' })
	const { isMobile, setOpenMobile } = useSidebar()

	return (
		<SidebarContent {...props}>
			<SidebarGroup>
				<SidebarGroupContent>
					<SidebarMenu>
						{(auth.user.role === 'admin' ? navLinks : userNavLinks).map(
							(link) => {
								const isActiveRoute = !!matchRoute({ to: link.to, fuzzy: true })

								return (
									<SidebarMenuItem key={link.to}>
										<SidebarMenuButton
											render={
												<Link
													{...link}
													activeOptions={{ exact: false }}
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
							}
						)}
					</SidebarMenu>
				</SidebarGroupContent>
			</SidebarGroup>
		</SidebarContent>
	)
}
