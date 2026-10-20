import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
} from '@altstack/ui/components/card'
import { Skeleton } from '@altstack/ui/components/skeleton'

export function LoadingStatus({ children }: { children: React.ReactNode }) {
	return <output className="sr-only">{children}</output>
}

// Playwright: the standard card is 204px inside its 2px link padding.
// Use the same Card parts, 28px title, 40px tagline and 16px stat rows.
export function ProjectCardSkeleton() {
	return (
		<div className="min-w-0 rounded-xl p-0.5 ring-1 ring-border">
			<Card className="size-full ring-0">
				<CardHeader className="gap-4">
					<div className="flex items-start gap-2">
						<Skeleton className="size-7 shrink-0" />
						<Skeleton className="h-7 w-3/5" />
					</div>
				</CardHeader>
				<CardContent className="flex flex-1 flex-col gap-4">
					<div className="flex h-10 flex-col justify-center gap-2">
						<Skeleton className="h-3 w-full" />
						<Skeleton className="h-3 w-4/5" />
					</div>
					<div className="grid gap-2">
						{[0, 1].map((key) => (
							<Skeleton key={key} className="h-4 w-full" />
						))}
					</div>
					<Skeleton className="h-4 w-1/2" />
				</CardContent>
			</Card>
		</div>
	)
}

export function ProjectResultsSkeleton({
	label = 'Loading projects…',
}: {
	label?: string
}) {
	return (
		<section
			data-skeleton="project-results"
			aria-busy="true"
			aria-label="Project results"
			className="container mx-auto mb-10 w-full max-w-6xl px-4 lg:px-16"
		>
			<LoadingStatus>{label}</LoadingStatus>
			<div
				aria-hidden="true"
				className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
			>
				{Array.from({ length: 12 }, (_, key) => (
					<ProjectCardSkeleton key={key} />
				))}
			</div>
		</section>
	)
}

export function ProjectDetailSkeleton() {
	return (
		<div
			data-skeleton="project-detail"
			aria-busy="true"
			className="container mx-auto w-full max-w-6xl px-6 pt-22 pb-10 lg:px-16"
		>
			<LoadingStatus>Loading project…</LoadingStatus>
			<div
				aria-hidden="true"
				className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)]"
			>
				<div className="flex min-w-0 flex-col gap-8 self-start">
					<div className="flex h-17 items-center justify-between gap-3 py-4 lg:h-22">
						<div className="flex min-w-0 flex-1 items-center gap-3">
							<Skeleton className="size-7.5 shrink-0" />
							<Skeleton className="h-9 w-1/2" />
						</div>
						<Skeleton className="h-12 w-48 max-lg:hidden" />
						<Skeleton className="size-8 lg:hidden" />
					</div>
					<div className="-mt-8 flex flex-col gap-4">
						<Skeleton className="h-14 w-full lg:h-7" />
						<div className="flex gap-3">
							<Skeleton className="h-9 w-31" />
							<Skeleton className="h-9 w-32" />
						</div>
					</div>
					<Skeleton className="aspect-video w-full rounded-lg" />
					<div className="flex flex-col gap-4">
						<Skeleton className="h-7 w-2/5" />
						<Skeleton className="h-5 w-full" />
						<Skeleton className="h-5 w-4/5" />
					</div>
				</div>
				<div className="pt-5">
					<Card>
						<CardHeader>
							<Skeleton className="h-7 w-32" />
						</CardHeader>
						<CardContent className="flex flex-col gap-2.5">
							<Skeleton className="h-21.25 w-full" />
							{Array.from({ length: 5 }, (_, key) => (
								<Skeleton key={key} className="h-5 w-full" />
							))}
							<Skeleton className="mt-1 h-4 w-3/4" />
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	)
}

export function CategoryControlsSkeleton() {
	return (
		<div aria-hidden="true" data-skeleton="category-controls">
			<div className="container mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pt-28 lg:px-16">
				<Skeleton className="h-5 w-48" />
				<Skeleton className="h-9 w-3/4 sm:h-10" />
				<Skeleton className="h-7 w-full max-w-3xl" />
			</div>
			<div className="container mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 md:flex-row lg:px-16">
				<Skeleton className="h-8 flex-1 max-md:w-full max-md:flex-none" />
				<Skeleton className="h-8 w-full md:max-w-48" />
			</div>
		</div>
	)
}

export function ActivityPending() {
	return (
		<div
			data-skeleton="activity"
			aria-busy="true"
			className="container mx-auto w-full max-w-6xl px-6 pt-36 pb-10 lg:px-16"
		>
			<LoadingStatus>Loading activity…</LoadingStatus>
			<Skeleton aria-hidden="true" className="h-5 w-28" />
			<div className="mt-4 flex flex-col gap-2">
				<h1 className="text-3xl font-medium">Last Commits</h1>
				<p className="text-base text-muted-foreground">
					Recent commits and contributions to the project.
				</p>
			</div>
			<div aria-hidden="true" className="mt-6">
				{[0, 1, 2].map((key) => (
					<div key={key} className="flex flex-col gap-2">
						<div className="flex items-center gap-4">
							<Skeleton className="size-6" />
							<Skeleton className="h-4 w-40" />
						</div>
						<Card className="mb-4 ml-10">
							<CardHeader>
								<Skeleton className="h-6 w-full" />
							</CardHeader>
							{key === 0 && (
								<CardContent>
									<Skeleton className="h-5 w-4/5" />
								</CardContent>
							)}
							<CardFooter>
								<Skeleton className="size-6" />
								<Skeleton className="ml-2 h-5 w-32" />
							</CardFooter>
						</Card>
					</div>
				))}
			</div>
		</div>
	)
}
