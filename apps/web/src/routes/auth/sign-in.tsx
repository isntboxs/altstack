import { createFileRoute } from '@tanstack/react-router'

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@altstack/ui/components/card'

import { SignInForm, signInDescription } from '#/components/sign-in-form'

export const Route = createFileRoute('/auth/sign-in')({
	component: RouteComponent,
})

function RouteComponent() {
	const { returnTo, error } = Route.useSearch()
	return (
		<div className="container mx-auto w-full max-w-6xl px-6 pt-32 pb-10 sm:pt-38 lg:px-16">
			<Card className="mx-auto w-full max-w-sm">
				<CardHeader>
					<CardTitle>Sign in</CardTitle>
					<CardDescription>{signInDescription}</CardDescription>
				</CardHeader>
				<CardContent>
					<SignInForm returnTo={returnTo} authError={error} />
				</CardContent>
			</Card>
		</div>
	)
}
