import {
	IconActivity,
	IconArrowRight,
	IconLicense,
	IconMenu2,
	IconTag,
} from '@tabler/icons-react'
import {
	Link,
	useLocation,
	useMatchRoute,
	useRouter,
} from '@tanstack/react-router'
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
	NavigationMenuContent,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	NavigationMenuTrigger,
	navigationMenuTriggerStyle,
} from '@altstack/ui/components/navigation-menu'
import { Separator } from '@altstack/ui/components/separator'

import { AuthDialog } from '#/components/auth-dialog'
import { BrandMark } from '#/components/brand-mark'
import { ThemeSwitcher } from '#/components/theme-switcher'
import { UserAvatar } from '#/components/user-avatar'

const resourceLinks = [
	{ to: '/tags', label: 'Tags', icon: IconTag },
	{ to: '/licenses', label: 'Licenses', icon: IconLicense },
	{ to: '/activity', label: 'Activity', icon: IconActivity },
] as const

/** Provides responsive public navigation and the current session's account actions. */
export const Header = ({
	auth,
}: {
	auth: typeof authClient.$Infer.Session | null
}) => {
	const [openAuthDialog, setOpenAuthDialog] = useState(false)
	const [openNavigation, setOpenNavigation] = useState(false)

	const { pathname, href } = useLocation()
	const matchRoute = useMatchRoute()

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
					<div className="flex min-w-0 items-center gap-0 sm:gap-2 lg:gap-12">
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
								<DropdownMenuGroup>
									<DropdownMenuItem
										onClick={() => setOpenNavigation(false)}
										render={<Link to="/collections" />}
									>
										Collections
									</DropdownMenuItem>
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
								</DropdownMenuGroup>
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
							<NavigationMenuList className="gap-2">
								<NavigationMenuItem>
									<NavigationMenuLink
										render={<Link to="/collections" viewTransition />}
										className={navigationMenuTriggerStyle({
											className: `h-fit px-2`,
										})}
										active={
											!!matchRoute({
												to: '/collections',
												includeSearch: true,
												fuzzy: true,
											})
										}
									>
										Collections
									</NavigationMenuLink>
								</NavigationMenuItem>
								<NavigationMenuItem>
									<NavigationMenuLink
										render={<Link to="/categories" viewTransition />}
										className={navigationMenuTriggerStyle({
											className: `h-fit px-2`,
										})}
										active={
											!!matchRoute({
												to: '/categories',
												includeSearch: true,
												fuzzy: true,
											})
										}
									>
										Categories
									</NavigationMenuLink>
								</NavigationMenuItem>
								<NavigationMenuItem>
									<NavigationMenuTrigger className="h-fit px-2">
										Resources
									</NavigationMenuTrigger>
									<NavigationMenuContent className="p-0">
										<div className="grid min-h-48 w-100 grid-cols-[minmax(0,1.2fr)_auto_minmax(0,1fr)]">
											<div className="p-2">
												<p className="px-2 py-2 text-[0.625rem] font-medium tracking-wider text-muted-foreground uppercase">
													Resources
												</p>
												<ul className="flex flex-col gap-0.5">
													{resourceLinks.map(({ to, label, icon: Icon }) => (
														<li key={to}>
															<NavigationMenuLink
																render={<Link to={to} viewTransition />}
																className="text-muted-foreground hover:text-foreground focus:text-foreground"
																active={
																	!!matchRoute({
																		to,
																		includeSearch: true,
																		fuzzy: true,
																	})
																}
															>
																<Icon aria-hidden="true" />
																{label}
															</NavigationMenuLink>
														</li>
													))}
												</ul>
											</div>
											<Separator orientation="vertical" />
											<NavigationMenuLink
												render={<Link to="/submit" viewTransition />}
												className="flex flex-col items-start gap-1 rounded-l-none! bg-muted/20 p-4 text-start"
											>
												<p className="text-sm font-medium">
													Submit your project
												</p>
												<p className="text-xs leading-relaxed text-muted-foreground">
													Add an open source project to the directory.
												</p>
												<div className="mt-auto flex gap-1 text-xs">
													Submit a project
													<IconArrowRight aria-hidden="true" />
												</div>
											</NavigationMenuLink>
										</div>
									</NavigationMenuContent>
								</NavigationMenuItem>
							</NavigationMenuList>
						</NavigationMenu>
					</div>

					<div className="flex items-center gap-2">
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
							<Link to={user.role === 'admin' ? '/admin' : '/submission'} />
						}
					>
						{user.role === 'admin' ? 'Admin overview' : 'Submission'}
					</DropdownMenuItem>
					<DropdownMenuItem render={<Link to="/managed" />}>
						My projects
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
