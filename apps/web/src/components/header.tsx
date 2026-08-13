import { IconMenu2 } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'
import { Layers2, Layers } from 'reicon-react'

import { env } from '@altstack/env/web'

import { Button, buttonVariants } from '@altstack/ui/components/button'
import { cn } from '@altstack/ui/lib/utils.ts'

import { ThemeSwitcher } from '#/components/theme-switcher'

export const Header = () => (
	<header className="fixed top-0 z-50 h-12 w-full bg-background">
		<div className="container mx-auto flex h-full w-full max-w-6xl items-center justify-between px-4 lg:px-16">
			<div className="flex items-center gap-2">
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
			</div>

			<div className="flex items-center gap-2">
				<ThemeSwitcher />

				<Link
					to="."
					className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
					viewTransition
				>
					<span className="text-muted-foreground">Sign in</span>
				</Link>
			</div>
		</div>
	</header>
)
