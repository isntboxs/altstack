import { IconMenu2 } from '@tabler/icons-react'
import { Link, useLocation, useRouter } from '@tanstack/react-router'
import { log } from 'evlog/client'
import { useState } from 'react'
import { Bookmark2, Logout4 } from 'reicon-react'

import { authClient } from '@altstack/auth/client'

import { env } from '@altstack/env/web'

import { Button, buttonVariants } from '@altstack/ui/components/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
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
import { BrandMark } from '#/components/brand-mark'
import { ThemeSwitcher } from '#/components/theme-switcher'
import { UserAvatar } from '#/components/user-avatar'

/** Provides responsive public navigation and the current session's account actions. */
export const Header = ({
	auth,
}: {
	auth: typeof authClient.$Infer.Session | null
}) => {
	const [openAuthDialog, setOpenAuthDialog] = useState(false)
	const [openNavigation, setOpenNavigation] = useState(false)

	const { pathname, href } = useLocation()

	const handleAuthDialog = () => {
		setOpenAuthDialog((prev) => !prev)
	}

	return (
		<>
			<AuthDialog
				open={openAuthDialog}
				onOpenChange={setOpenAuthDialog}
				returnTo={href}
			/>

			<header className="fixed top-0 z-50 h-12 w-full bg-background">
				<div className="container mx-auto flex h-full w-full max-w-6xl items-center justify-between px-1 sm:px-4 lg:px-16">
					<div className="flex min-w-0 items-center gap-0 sm:gap-2 lg:gap-8">
						<DropdownMenu
							open={openNavigation}
							onOpenChange={setOpenNavigation}
						>
							<DropdownMenuTrigger
								render={
									<Button
										size="icon-sm"
										variant="ghost"
										className="lg:hidden"
										aria-label="Open navigation"
									>
										<IconMenu2 />
									</Button>
								}
							/>
							<DropdownMenuContent align="start">
								<DropdownMenuItem
									onClick={() => setOpenNavigation(false)}
									render={
										<Link
											to="/categories"
											activeOptions={{ includeSearch: false }}
											activeProps={{ className: 'font-semibold' }}
										/>
									}
								>
									Categories
								</DropdownMenuItem>
								<DropdownMenuItem
									onClick={() => setOpenNavigation(false)}
									render={<Link to="/tags" />}
								>
									Tags
								</DropdownMenuItem>{' '}
								<DropdownMenuItem
									onClick={() => setOpenNavigation(false)}
									render={<Link to="/licenses" />}
								>
									Licenses
								</DropdownMenuItem>
								<DropdownMenuItem
									onClick={() => setOpenNavigation(false)}
									render={<Link to="/activity" />}
								>
									Activity
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>

						<Link
							to="/"
							viewTransition
							className="flex items-center gap-1 sm:gap-1.5"
						>
							<BrandMark />

							<span className="text-base font-medium lowercase">
								{env.VITE_APP_NAME}
							</span>
						</Link>

						<NavigationMenu className="max-lg:hidden">
							<NavigationMenuList>
								<NavigationMenuItem>
									<NavigationMenuLink
										render={
											<Link
												to="/categories"
												activeOptions={{ includeSearch: false }}
												activeProps={{
													className: 'font-semibold text-primary',
												}}
												viewTransition
											/>
										}
										className={navigationMenuTriggerStyle({
											className: 'h-fit p-1',
										})}
									>
										Categories
									</NavigationMenuLink>
								</NavigationMenuItem>
								<NavigationMenuItem>
									<NavigationMenuLink
										render={<Link to="/tags" viewTransition />}
										className={navigationMenuTriggerStyle({
											className: 'h-fit p-1',
										})}
									>
										Tags
									</NavigationMenuLink>
								</NavigationMenuItem>{' '}
								<NavigationMenuItem>
									<NavigationMenuLink
										render={<Link to="/licenses" viewTransition />}
										className={navigationMenuTriggerStyle({
											className: 'h-fit p-1',
										})}
									>
										Licenses
									</NavigationMenuLink>
								</NavigationMenuItem>
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

					<div className="flex shrink-0 items-center gap-0 sm:gap-2">
						<ThemeSwitcher />

						<Link
							to="/submit"
							viewTransition
							className={buttonVariants({
								variant: 'outline',
								size: 'sm',
							})}
						>
							Submit
						</Link>

						{!auth ? (
							<SignInButton
								pathname={pathname}
								onClickButton={handleAuthDialog}
							/>
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

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button size="icon" variant="ghost" aria-label="Open user menu">
						<UserAvatar image={user.image} name={user.name} />
					</Button>
				}
			/>

			<DropdownMenuContent className="w-64" align="end">
				<DropdownMenuGroup>
					<DropdownMenuItem
						render={
							<Link to={user.role === 'admin' ? '/projects' : '/submission'} />
						}
					>
						{user.role === 'admin' ? 'Projects' : 'Submission'}
					</DropdownMenuItem>
					<DropdownMenuItem render={<Link to="/bookmarks" />}>
						<Bookmark2 aria-hidden="true" />
						Bookmarks
					</DropdownMenuItem>
				</DropdownMenuGroup>

				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem variant="destructive" onClick={handleSignOut}>
						<Logout4 />
						Sign out
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

const SignInButton = ({
	pathname,
	onClickButton,
}: {
	pathname: string
	onClickButton: () => void
}) => {
	if (pathname.startsWith('/auth/')) {
		return (
			<Link
				to="/auth/sign-in"
				className={buttonVariants({
					variant: 'outline',
					size: 'sm',
				})}
			>
				Sign in
			</Link>
		)
	}

	return (
		<Button variant="outline" size="sm" onClick={onClickButton}>
			<span className="text-muted-foreground">Sign in</span>
		</Button>
	)
}
