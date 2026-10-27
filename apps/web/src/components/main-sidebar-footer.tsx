import { IconBrowserPlus, IconDots, IconLogout2 } from '@tabler/icons-react'
import { Link, useRouteContext, useRouter } from '@tanstack/react-router'
import type { ComponentProps, FC } from 'react'

import { authClient } from '@altstack/auth/client'

import { Button } from '@altstack/ui/components/button'
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from '@altstack/ui/components/drawer'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@altstack/ui/components/dropdown-menu'
import {
	SidebarFooter,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from '@altstack/ui/components/sidebar'
import { toast } from '@altstack/ui/components/toast'

import { UserAvatar } from '#/components/user-avatar'

type MainSidebarFooterProps = ComponentProps<typeof SidebarFooter>

/** Keeps public-site navigation and session actions reachable in every sidebar layout. */
export const MainSidebarFooter: FC<MainSidebarFooterProps> = ({ ...props }) => (
	<SidebarFooter {...props}>
		<SidebarMenu className="gap-2">
			<SidebarMenuItem>
				<SidebarMenuButton
					aria-label="Visit site"
					tooltip="Visit site"
					render={<Link to="/" target="_blank" />}
				>
					<IconBrowserPlus />
					<span className="group-data-[collapsible=icon]:hidden">
						Visit Site
					</span>
				</SidebarMenuButton>
			</SidebarMenuItem>

			<SidebarMenuItem>
				<UserButton />
			</SidebarMenuItem>
		</SidebarMenu>
	</SidebarFooter>
)

/** Uses a drawer on mobile and an anchored dropdown on desktop for account actions. */
const UserButton = () => {
	const { auth } = useRouteContext({ from: '/_main' })
	const router = useRouter()

	const { isMobile } = useSidebar()

	const handleSignOut = async () => {
		await authClient.signOut({
			fetchOptions: {
				onSuccess: () => {
					void router.invalidate()
				},
				onError: (ctx) => {
					toast.add({
						type: 'error',
						title: 'Sign Out Failed',
						description: ctx.error.message,
					})
				},
			},
		})
	}

	if (isMobile) {
		return (
			<Drawer>
				<DrawerTrigger
					render={
						<SidebarMenuButton
							size="lg"
							aria-label={`Open account menu for ${auth.user.name}`}
							className="cursor-pointer data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
						>
							<UserAvatar
								image={auth.user.image}
								name={auth.user.name}
								size="default"
							/>
							<div className="grid flex-1 text-left text-sm leading-tight">
								<span className="truncate font-semibold">{auth.user.name}</span>
								<span className="truncate text-xs">{auth.user.email}</span>
							</div>
							<IconDots className="ml-auto size-4" />
						</SidebarMenuButton>
					}
				/>

				<DrawerContent>
					<DrawerHeader className="font-normal">
						<div className="flex items-center gap-2 text-left text-sm">
							<UserAvatar image={auth.user.image} name={auth.user.name} />
							<div className="grid flex-1 text-left text-sm leading-tight">
								<DrawerTitle className="truncate font-semibold">
									{auth.user.name}
								</DrawerTitle>
								<DrawerDescription className="truncate text-xs">
									{auth.user.email}
								</DrawerDescription>
							</div>
						</div>
					</DrawerHeader>

					<DrawerFooter>
						<DrawerClose
							render={
								<Button
									variant="destructive"
									onClick={handleSignOut}
									className="w-full"
								>
									<IconLogout2 />
									Sign out
								</Button>
							}
						/>
					</DrawerFooter>
				</DrawerContent>
			</Drawer>
		)
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<SidebarMenuButton
						size="lg"
						aria-label={`Open account menu for ${auth.user.name}`}
						tooltip={auth.user.name}
						className="group-data-[collapsible=icon]:justify-center data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
					>
						<UserAvatar
							image={auth.user.image}
							name={auth.user.name}
							size="default"
						/>
						<div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
							<span className="truncate font-medium">{auth.user.name}</span>
							<span className="truncate text-xs text-muted-foreground">
								{auth.user.email}
							</span>
						</div>
						<IconDots className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
					</SidebarMenuButton>
				}
			/>

			<DropdownMenuContent
				className="w-(--anchor-width) min-w-56"
				side="right"
				align="end"
				sideOffset={18}
			>
				<DropdownMenuGroup>
					<DropdownMenuLabel className="p-0 font-normal">
						<div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
							<UserAvatar image={auth.user.image} name={auth.user.name} />
							<div className="grid flex-1 text-left text-sm leading-tight">
								<span className="truncate font-medium">{auth.user.name}</span>
								<span className="truncate text-xs text-muted-foreground">
									{auth.user.email}
								</span>
							</div>
						</div>
					</DropdownMenuLabel>
				</DropdownMenuGroup>

				<DropdownMenuSeparator />

				<DropdownMenuGroup>
					<DropdownMenuItem variant="destructive" onClick={handleSignOut}>
						<IconLogout2 />
						Sign out
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
