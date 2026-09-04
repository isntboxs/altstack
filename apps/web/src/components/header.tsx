import { IconLayoutDashboard, IconMenu2 } from '@tabler/icons-react'
import { Link, useRouter } from '@tanstack/react-router'
import { log } from 'evlog/client'
import { useState } from 'react'
import { Layers2, Layers, Bookmark2, Logout4 } from 'reicon-react'

import { authClient } from '@altstack/auth/client'

import { env } from '@altstack/env/web'

import { Button } from '@altstack/ui/components/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@altstack/ui/components/dropdown-menu'
import {
	NavigationMenu,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	navigationMenuTriggerStyle,
} from '@altstack/ui/components/navigation-menu'

import { AuthDialog } from '#/components/auth-dialog'
import { ThemeSwitcher } from '#/components/theme-switcher'
import { UserAvatar } from '#/components/user-avatar'

export const Header = ({
	auth,
}: {
	auth: typeof authClient.$Infer.Session | null
}) => {
	const [openAuthDialog, setOpenAuthDialog] = useState(false)

	const handleAuthDialog = () => {
		setOpenAuthDialog((prev) => !prev)
	}

	return (
		<>
			<AuthDialog open={openAuthDialog} onOpenChange={setOpenAuthDialog} />

			<header className="fixed top-0 z-50 h-12 w-full bg-background">
				<div className="container mx-auto flex h-full w-full max-w-6xl items-center justify-between px-4 lg:px-16">
					<div className="flex items-center gap-2 lg:gap-8">
						<Button size="icon-sm" variant="ghost" className="lg:hidden">
							<IconMenu2 />
						</Button>

						<Link
							to="/"
							viewTransition
							className="group/logo flex items-center gap-1.5"
						>
							<div className="flex size-fit items-center justify-center">
								<Layers className="size-5 rotate-0 opacity-100 transition-all duration-300 ease-in-out group-hover/logo:rotate-180 group-hover/logo:opacity-0" />
								<Layers2
									className="absolute size-5 -rotate-180 opacity-0 transition-all duration-300 ease-in-out group-hover/logo:rotate-0 group-hover/logo:opacity-100"
									weight="Filled"
								/>
							</div>

							<h1 className="text-base font-medium">{env.VITE_APP_NAME}</h1>
						</Link>

						<NavigationMenu>
							<NavigationMenuList>
								<NavigationMenuItem>
									<NavigationMenuLink
										render={<Link to="/activity" viewTransition />}
										className={navigationMenuTriggerStyle({
											className: 'h-fit p-1',
										})}
									>
										Activity
									</NavigationMenuLink>
								</NavigationMenuItem>
							</NavigationMenuList>
						</NavigationMenu>
					</div>

					<div className="flex items-center gap-2">
						<ThemeSwitcher />

						{!auth ? (
							<Button variant="outline" size="sm" onClick={handleAuthDialog}>
								<span className="text-muted-foreground">Sign in</span>
							</Button>
						) : (
							<UserButton user={auth.user} />
						)}
					</div>
				</div>
			</header>
		</>
	)
}

const UserButton = ({
	user,
}: {
	user: typeof authClient.$Infer.Session.user
}) => {
	const router = useRouter()

	const handleSignOut = async () => {
		await authClient.signOut({
			fetchOptions: {
				onSuccess: async () => {
					await router.invalidate({ sync: true })
				},

				onError: (ctx) => {
					log.error({ error: ctx.error })
				},
			},
		})
	}

	const handleNavigateDashboard = () => {
		void router.navigate({ to: '/dashboard', viewTransition: true })
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button size="icon-sm" variant="ghost">
						<UserAvatar image={user.image} name={user.name} />
					</Button>
				}
			/>

			<DropdownMenuContent align="end">
				<DropdownMenuItem onClick={handleNavigateDashboard}>
					<IconLayoutDashboard />
					Dashboard
				</DropdownMenuItem>

				<DropdownMenuItem>
					<Bookmark2 />
					Bookmarks
				</DropdownMenuItem>

				<DropdownMenuSeparator />
				<DropdownMenuItem variant="destructive" onClick={handleSignOut}>
					<Logout4 />
					Sign out
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
