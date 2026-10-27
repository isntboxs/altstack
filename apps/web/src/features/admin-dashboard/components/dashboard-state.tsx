import { IconRefresh } from '@tabler/icons-react'
import { format, formatDistanceToNow } from 'date-fns'
import type { ReactNode } from 'react'

import {
	Alert,
	AlertDescription,
	AlertTitle,
} from '@altstack/ui/components/alert'
import { Button } from '@altstack/ui/components/button'
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from '@altstack/ui/components/empty'
import { Skeleton } from '@altstack/ui/components/skeleton'

export function AdminPageHeader({
	title,
	description,
	children,
}: {
	title: string
	description: string
	children?: ReactNode
}) {
	return (
		<header className="flex flex-wrap items-start justify-between gap-4">
			<div className="flex flex-col gap-1">
				<h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
				<p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
			</div>
			{children && (
				<div className="flex flex-wrap items-center gap-2">{children}</div>
			)}
		</header>
	)
}

export function AdminPending() {
	return (
		<output aria-label="Loading admin data" className="flex flex-col gap-4">
			<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
				{[1, 2, 3, 4].map((id) => (
					<Skeleton key={id} className="h-32 w-full" />
				))}
			</div>
			<Skeleton className="h-72 w-full" />
		</output>
	)
}

export function AdminError({
	retry,
	fetching = false,
}: {
	retry: () => void
	fetching?: boolean
}) {
	return (
		<Alert variant="destructive">
			<AlertTitle>Unable to load admin data</AlertTitle>
			<AlertDescription>
				<p>Check your connection and admin session, then try again.</p>
				<Button variant="outline" size="sm" disabled={fetching} onClick={retry}>
					Try again
				</Button>
			</AlertDescription>
		</Alert>
	)
}

export function AdminEmpty({
	title = 'All caught up',
	description = 'There is nothing awaiting review in this queue.',
}: {
	title?: string
	description?: string
}) {
	return (
		<Empty>
			<EmptyHeader>
				<EmptyTitle>{title}</EmptyTitle>
				<EmptyDescription>{description}</EmptyDescription>
			</EmptyHeader>
		</Empty>
	)
}

export function AdminTime({
	value,
	relative = false,
}: {
	value: Date | string | null
	relative?: boolean
}) {
	if (!value) return <span className="text-muted-foreground">Unavailable</span>
	const date = new Date(value)
	return (
		<time dateTime={date.toISOString()} title={format(date, 'PPpp')}>
			{relative
				? formatDistanceToNow(date, { addSuffix: true })
				: format(date, 'PPp')}
		</time>
	)
}

export function RefreshButton({
	fetching,
	refresh,
}: {
	fetching: boolean
	refresh: () => void
}) {
	return (
		<Button variant="outline" size="sm" disabled={fetching} onClick={refresh}>
			<IconRefresh data-icon="inline-start" />
			{fetching ? 'Refreshing…' : 'Refresh'}
		</Button>
	)
}
