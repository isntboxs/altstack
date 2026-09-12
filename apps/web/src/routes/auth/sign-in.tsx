import { IconBrandGithub } from '@tabler/icons-react'
import { createFileRoute } from '@tanstack/react-router'
import { log } from 'evlog/client'
import { useTransition } from 'react'

import { authClient } from '@altstack/auth/client'

import { env } from '@altstack/env/web'

import { Button } from '@altstack/ui/components/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@altstack/ui/components/card'
import { Spinner } from '@altstack/ui/components/spinner'

import { resolveReturnTo } from '#/utils/return-to'

export const Route = createFileRoute('/auth/sign-in')({
	component: RouteComponent,
})

function RouteComponent() {
	const [isLoading, startTransition] = useTransition()
	const { returnTo } = Route.useSearch()

	const callbackURL = new URL(
		resolveReturnTo(returnTo, '/'),
		env.VITE_APP_URL
	).toString()

	const signIn = () => {
		startTransition(async () => {
			await authClient.signIn.social({
				provider: 'github',
				callbackURL,
				fetchOptions: {
					onError: (ctx) => {
						log.error({ error: ctx.error })
					},
				},
			})
		})
	}

	return (
		<div className="container mx-auto w-full max-w-6xl px-6 pt-38 pb-10 lg:px-16">
			<Card className="mx-auto w-full max-w-sm rounded-xl ring-1 ring-foreground/10">
				<CardHeader>
					<CardTitle className="text-2xl font-semibold">
						Welcome back!
					</CardTitle>

					<CardDescription className="text-sm text-muted-foreground">
						Sign in to discover curated developer tools and manage your saved
						open-source projects.
					</CardDescription>
				</CardHeader>

				<CardContent>
					<div className="flex items-center justify-center">
						<Button
							variant="outline"
							className="w-full"
							onClick={signIn}
							disabled={isLoading}
						>
							<span>Continue with Github</span>
							{isLoading ? <Spinner /> : <IconBrandGithub />}
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	)
}
