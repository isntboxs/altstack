import { Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import { Button } from '@altstack/ui/components/button'

export function PublicPending({
	label = 'Loading projects…',
}: {
	label?: string
}) {
	return (
		<div className="container mx-auto w-full max-w-6xl space-y-4 px-4 py-8 lg:px-16">
			<output>{label}</output>
			<div
				aria-hidden="true"
				className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
			>
				{[1, 2, 3].map((key) => (
					<div
						key={key}
						className="h-48 rounded-xl border border-border bg-muted/40"
					/>
				))}
			</div>
		</div>
	)
}

export function ProjectPending() {
	return (
		<div className="pt-24">
			<PublicPending label="Loading project…" />
		</div>
	)
}

export function PublicError({
	title = 'Page unavailable',
}: {
	title?: string
}) {
	const router = useRouter()
	const [retrying, setRetrying] = useState(false)
	const retry = async () => {
		setRetrying(true)
		try {
			// Mark external cache stale before Router re-runs loaders. Do not refetch
			// active observers early, which could throw back into the same boundary.
			await router.options.context.queryClient.invalidateQueries({
				refetchType: 'none',
			})
			await router.invalidate({ sync: true })
		} finally {
			setRetrying(false)
		}
	}
	return (
		<div
			role="alert"
			className="container mx-auto max-w-6xl space-y-4 px-4 pt-28 pb-10 lg:px-16"
		>
			<h1 className="text-3xl font-medium">{title}</h1>
			<p className="text-muted-foreground">Please try again in a moment.</p>
			<div className="flex flex-wrap items-center gap-4">
				<Button disabled={retrying} onClick={retry}>
					{retrying ? 'Trying again…' : 'Try again'}
				</Button>
				<Link to="/" className="underline underline-offset-4">
					Browse projects
				</Link>
			</div>
		</div>
	)
}

export function PublicNotFound({
	title = 'Page not found',
}: {
	title?: string
}) {
	return (
		<div className="container mx-auto max-w-6xl space-y-4 px-4 pt-28 pb-10 lg:px-16">
			<h1 className="text-3xl font-medium">{title}</h1>
			<p className="text-muted-foreground">
				This page is not available in the public catalogue.
			</p>
			<Link to="/" className="underline underline-offset-4">
				Browse projects
			</Link>
		</div>
	)
}
