import {
	IconArrowDown,
	IconArrowUp,
	IconCheck,
	IconDeviceFloppy,
	IconPlus,
	IconSearch,
	IconX,
} from '@tabler/icons-react'
import {
	useMutation,
	useQueryClient,
	useSuspenseQuery,
} from '@tanstack/react-query'
import { Link, useBlocker } from '@tanstack/react-router'
import { useState, useTransition } from 'react'

import type { ORPCRouterOutputs } from '@altstack/api/routers'

import {
	featuredWebsiteUrl,
	MAX_FEATURED_PROJECTS,
} from '@altstack/shared/schemas/featured'

import {
	Alert,
	AlertDescription,
	AlertTitle,
} from '@altstack/ui/components/alert'
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@altstack/ui/components/alert-dialog'
import { Badge } from '@altstack/ui/components/badge'
import { Button } from '@altstack/ui/components/button'
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@altstack/ui/components/card'
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from '@altstack/ui/components/empty'
import { Field, FieldLabel } from '@altstack/ui/components/field'
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from '@altstack/ui/components/input-group'
import { Skeleton } from '@altstack/ui/components/skeleton'
import { toast } from '@altstack/ui/components/toast'

import { ProjectLogo } from '#/components/project-media'
import { QueryBoundary } from '#/components/query-boundary'
import { adminFeaturedQueries } from '#/features/admin-featured/queries'
import { adminProjectQueries } from '#/features/admin-projects/queries'
import { invalidateCatalog } from '#/utils/invalidate-catalog'
import { adminORPC } from '#/utils/orpc'

type Selection = ORPCRouterOutputs['admin']['featured']['list']['projects']
function available(project: Selection[number]) {
	return (
		project.status === 'published' && !!featuredWebsiteUrl(project.websiteUrl)
	)
}
function websiteHost(value: string | null) {
	const url = featuredWebsiteUrl(value)
	return url ? new URL(url).hostname : null
}

export function FeaturedEditor() {
	const { data } = useSuspenseQuery(adminFeaturedQueries.list())
	return <SelectionEditor initial={data.projects} />
}

function SelectionEditor({ initial }: { initial: Selection }) {
	const [changing, startTransition] = useTransition()
	const queryClient = useQueryClient()
	const [projects, setProjects] = useState(initial)
	const [baseline, setBaseline] = useState(initial.map(({ id }) => id))
	const [error, setError] = useState<{
		operation: 'save' | 'reload'
		message: string
	} | null>(null)
	const [reloading, setReloading] = useState(false)
	const [confirmReload, setConfirmReload] = useState(false)
	const [search, setSearch] = useState('')
	const [text, setText] = useState('')
	const [page, setPage] = useState(1)
	const save = useMutation({
		...adminORPC.featured.update.mutationOptions(),
		retry: false,
		onSuccess: async (data) => {
			setProjects(data.projects)
			setBaseline(data.projects.map(({ id }) => id))
			setError(null)
			queryClient.setQueryData(adminFeaturedQueries.list().queryKey, data)
			await invalidateCatalog(queryClient)
			toast.add({ type: 'success', title: 'Featured projects saved' })
		},
		onError: (saveError) =>
			setError({ operation: 'save', message: saveError.message }),
	})
	const busy = save.isPending || reloading
	const dirty =
		JSON.stringify(projects.map(({ id }) => id)) !== JSON.stringify(baseline)
	const unavailable = projects.filter((project) => !available(project)).length
	const blocker = useBlocker({
		shouldBlockFn: () => dirty,
		enableBeforeUnload: dirty,
		withResolver: true,
	})
	async function reload() {
		setConfirmReload(false)
		setReloading(true)
		try {
			await queryClient.invalidateQueries({
				queryKey: adminORPC.featured.list.key(),
				refetchType: 'none',
			})
			const data = await queryClient.query(adminFeaturedQueries.list())
			setProjects(data.projects)
			setBaseline(data.projects.map(({ id }) => id))
			setError(null)
		} catch {
			setError({
				operation: 'reload',
				message:
					'Unable to reload the selection. Your unsaved changes have been kept.',
			})
		} finally {
			setReloading(false)
		}
	}
	function move(index: number, delta: number) {
		setProjects((previous) => {
			const next = [...previous],
				target = index + delta
			if (target < 0 || target >= next.length) return previous
			;[next[index], next[target]] = [next[target], next[index]]
			return next
		})
	}
	function clearSearch() {
		setText('')
		startTransition(() => {
			setSearch('')
			setPage(1)
		})
	}
	return (
		<div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
			<header className="flex flex-col gap-2">
				<h1 className="text-2xl font-semibold tracking-tight">
					Featured Projects
				</h1>
				<p className="max-w-2xl text-sm text-muted-foreground">
					Choose the projects readers discover in the sidebar. Arrange up to{' '}
					{MAX_FEATURED_PROJECTS} projects, preview the grid, then save your
					changes.
				</p>
			</header>
			{error && (
				<Alert variant="destructive">
					<AlertTitle>
						{error.operation === 'save'
							? 'Unable to save changes'
							: 'Unable to reload selection'}
					</AlertTitle>
					<AlertDescription>
						<p>{error.message}</p>
						<p>Your current selection is kept here until you save or reload.</p>
					</AlertDescription>
				</Alert>
			)}
			<div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
				<div className="flex min-w-0 flex-col gap-6">
					<section aria-labelledby="featured-selection-title">
						<Card>
							<CardHeader className="border-b">
								<CardTitle>
									<h2 id="featured-selection-title">
										Selected projects ({projects.length}/{MAX_FEATURED_PROJECTS}
										)
									</h2>
								</CardTitle>
								<CardDescription>
									Read left to right, then top to bottom. Use the arrows to
									change the display order.
								</CardDescription>
							</CardHeader>
							<CardContent>
								{projects.length > 0 ? (
									<ol
										aria-label="Featured selection"
										className="max-h-128 scroll-py-2 divide-y overflow-y-auto overscroll-contain rounded-lg border"
									>
										{projects.map((project, index) => (
											<li
												key={project.id}
												className="grid grid-cols-[1.25rem_2.25rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 p-3 sm:flex sm:flex-wrap sm:gap-3"
											>
												<span className="w-5 shrink-0 text-center text-xs text-muted-foreground">
													{index + 1}
												</span>
												<ProjectLogo
													src={project.logo}
													name={project.name}
													className="size-9 shrink-0 rounded-lg"
												/>
												<div className="flex min-w-0 flex-1 flex-col gap-1">
													<Link
														to="/projects/$id/edit"
														params={{ id: project.id }}
														className="w-fit rounded-sm text-sm font-medium wrap-anywhere underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
													>
														{project.name}
													</Link>
													<p className="truncate text-xs text-muted-foreground">
														{websiteHost(project.websiteUrl) ??
															'No valid website'}
													</p>
													{!available(project) && (
														<p className="text-xs text-destructive">
															Unavailable. Remove before saving.
														</p>
													)}
												</div>
												<div className="col-start-3 ml-auto flex items-center gap-1">
													<Button
														variant="ghost"
														size="icon-sm"
														aria-label={`Move ${project.name} up`}
														className="size-11 sm:size-7"
														disabled={busy || index === 0}
														onClick={() => move(index, -1)}
													>
														<IconArrowUp />
													</Button>
													<Button
														variant="ghost"
														size="icon-sm"
														aria-label={`Move ${project.name} down`}
														className="size-11 sm:size-7"
														disabled={busy || index === projects.length - 1}
														onClick={() => move(index, 1)}
													>
														<IconArrowDown />
													</Button>
													<Button
														variant="ghost"
														size="icon-sm"
														disabled={busy}
														aria-label={`Remove ${project.name} from featured`}
														className="size-11 sm:size-7"
														onClick={() =>
															setProjects((previous) =>
																previous.filter(({ id }) => id !== project.id)
															)
														}
													>
														<IconX />
													</Button>
												</div>
											</li>
										))}
									</ol>
								) : (
									<Empty className="border bg-muted/20 py-8">
										<EmptyHeader>
											<EmptyTitle>No featured projects selected</EmptyTitle>
											<EmptyDescription>
												Add projects below, then save the selection. Saving an
												empty selection hides the Featured Projects panel.
											</EmptyDescription>
										</EmptyHeader>
									</Empty>
								)}
								{unavailable > 0 && (
									<Alert variant="destructive" className="mt-4">
										<AlertTitle>Review unavailable projects</AlertTitle>
										<AlertDescription>
											Remove {unavailable} unavailable{' '}
											{unavailable === 1 ? 'project' : 'projects'} before
											saving. Only published projects with a valid website can
											appear.
										</AlertDescription>
									</Alert>
								)}
							</CardContent>
						</Card>
					</section>
					<section aria-labelledby="featured-candidates-title">
						<Card>
							<CardHeader className="border-b">
								<CardTitle>
									<h2 id="featured-candidates-title">Add projects</h2>
								</CardTitle>
								<CardDescription>
									Search the published catalogue. Projects need a website to be
									featured.
								</CardDescription>
							</CardHeader>
							<CardContent className="flex flex-col gap-4">
								<form
									onSubmit={(event) => {
										event.preventDefault()
										startTransition(() => {
											setSearch(text.trim())
											setPage(1)
										})
									}}
								>
									<Field>
										<FieldLabel htmlFor="featured-search">
											Search published projects
										</FieldLabel>
										<div className="flex gap-2">
											<InputGroup>
												<InputGroupAddon>
													<IconSearch aria-hidden="true" />
												</InputGroupAddon>
												<InputGroupInput
													id="featured-search"
													disabled={busy}
													placeholder="Search by project name…"
													value={text}
													onChange={(event) => setText(event.target.value)}
												/>
											</InputGroup>
											<Button variant="outline" type="submit" disabled={busy}>
												Search
											</Button>
										</div>
									</Field>
								</form>
								{search && (
									<div className="flex flex-wrap items-center justify-between gap-2">
										<p className="min-w-0 text-xs wrap-anywhere text-muted-foreground">
											Results for “{search}”
										</p>
										<Button
											variant="ghost"
											size="sm"
											disabled={busy}
											onClick={clearSearch}
										>
											Clear search
										</Button>
									</div>
								)}
								{projects.length === MAX_FEATURED_PROJECTS && (
									<Alert>
										<AlertTitle>
											All {MAX_FEATURED_PROJECTS} slots are filled
										</AlertTitle>
										<AlertDescription>
											Remove a selected project to make room for another.
										</AlertDescription>
									</Alert>
								)}
								<Candidates
									search={search}
									page={page}
									onPageChange={(nextPage) =>
										startTransition(() => setPage(nextPage))
									}
									projects={projects}
									disabled={busy}
									loading={changing}
									onClearSearch={clearSearch}
									onAdd={(project) =>
										setProjects((previous) =>
											previous.some(({ id }) => id === project.id) ||
											previous.length >= MAX_FEATURED_PROJECTS
												? previous
												: [...previous, project]
										)
									}
								/>
							</CardContent>
						</Card>
					</section>
				</div>
				<aside
					aria-label="Featured layout and publishing"
					className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-20"
				>
					<Card>
						<CardHeader className="border-b">
							<CardTitle>
								<h2>Layout preview</h2>
							</CardTitle>
							<CardDescription>6 columns × 4 rows</CardDescription>
							<CardAction>
								<Badge variant="secondary">
									{projects.length}/{MAX_FEATURED_PROJECTS}
								</Badge>
							</CardAction>
						</CardHeader>
						<CardContent className="flex flex-col gap-5">
							<div className="flex flex-col gap-3">
								<h3 className="text-sm font-medium">Featured Projects</h3>
								<ol
									aria-label="Featured layout preview"
									className="grid grid-cols-6 gap-2"
								>
									{Array.from({ length: MAX_FEATURED_PROJECTS }, (_, index) => {
										const project = projects.at(index)
										return (
											<li
												key={project?.id ?? `slot-${index}`}
												title={
													project
														? `${index + 1}. ${project.name}`
														: `Empty slot ${index + 1}`
												}
												className="flex aspect-square min-w-0 items-center justify-center rounded-lg border bg-background/50"
											>
												{project ? (
													<ProjectLogo
														src={project.logo}
														name={project.name}
														className="size-7 rounded-md bg-transparent"
													/>
												) : (
													<span className="text-xs text-muted-foreground">
														{index + 1}
													</span>
												)}
												<span className="sr-only">
													{project
														? `${index + 1}. ${project.name}${available(project) ? '' : ' (unavailable)'}`
														: `Empty slot ${index + 1}`}
												</span>
											</li>
										)
									})}
								</ol>
								<p className="text-xs leading-relaxed text-muted-foreground">
									The current project is hidden automatically on its own page.
									Narrow panels use fewer columns.
								</p>
							</div>
							<div className="flex flex-col gap-3 border-t pt-4">
								<div className="flex items-center justify-between gap-2 text-sm">
									<span>Selection</span>
									<span className="text-muted-foreground">
										{MAX_FEATURED_PROJECTS - projects.length} slots available
									</span>
								</div>
								<Button
									disabled={busy || !dirty || unavailable > 0}
									onClick={() =>
										save.mutate({
											body: {
												projectIds: projects.map(({ id }) => id),
												expectedProjectIds: baseline,
											},
										})
									}
								>
									<IconDeviceFloppy data-icon="inline-start" />
									{save.isPending ? 'Saving…' : 'Save changes'}
								</Button>
								<Button
									variant="outline"
									disabled={busy}
									onClick={() => {
										if (dirty) setConfirmReload(true)
										else void reload()
									}}
								>
									{reloading
										? 'Reloading…'
										: dirty
											? 'Discard changes and reload'
											: 'Reload selection'}
								</Button>
								<output className="text-center text-xs text-muted-foreground">
									{dirty ? 'You have unsaved changes' : 'No unsaved changes'}
								</output>
							</div>
						</CardContent>
					</Card>
					<p className="px-1 text-xs leading-relaxed text-muted-foreground">
						Changes go live after saving. Featuring a project does not change
						its catalogue position.
					</p>
				</aside>
			</div>
			<AlertDialog open={confirmReload} onOpenChange={setConfirmReload}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
						<AlertDialogDescription>
							Your selection and ordering will be replaced with the latest saved
							version.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Keep editing</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							onClick={() => void reload()}
						>
							Discard and reload
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
			<AlertDialog
				open={blocker.status === 'blocked'}
				onOpenChange={(open) => {
					if (!open) blocker.reset?.()
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Leave without saving?</AlertDialogTitle>
						<AlertDialogDescription>
							Your featured selection has unsaved changes. Save them before
							leaving to keep this order.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Keep editing</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							onClick={() => blocker.proceed?.()}
						>
							Discard changes
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	)
}

function Candidates(props: Parameters<typeof CandidateResults>[0]) {
	return (
		<QueryBoundary
			pending={<CandidatePending />}
			error={(_, retry) => (
				<Alert variant="destructive">
					<AlertTitle>Unable to load projects</AlertTitle>
					<AlertDescription>
						<p>
							Your selected projects have been kept. Check your session and
							retry the search.
						</p>
						<Button variant="outline" onClick={retry}>
							Retry project search
						</Button>
					</AlertDescription>
				</Alert>
			)}
		>
			<CandidateResults {...props} />
		</QueryBoundary>
	)
}

function CandidateResults({
	search,
	page,
	onPageChange,
	projects,
	disabled,
	loading,
	onAdd,
	onClearSearch,
}: {
	search: string
	page: number
	onPageChange: (page: number) => void
	projects: Selection
	disabled: boolean
	loading: boolean
	onAdd: (project: Selection[number]) => void
	onClearSearch: () => void
}) {
	const query = useSuspenseQuery({
		...adminProjectQueries.list({
			status: 'published',
			name: search || undefined,
			page,
			limit: 12,
		}),
		retry: false,
	})
	if (query.isError) {
		return (
			<Alert variant="destructive">
				<AlertTitle>Unable to load projects</AlertTitle>
				<AlertDescription>
					<p>
						Your selected projects have been kept. Check your session and retry
						the search.
					</p>
					<Button variant="outline" onClick={() => void query.refetch()}>
						Retry project search
					</Button>
				</AlertDescription>
			</Alert>
		)
	}
	return (
		<>
			{query.data.projects.length > 0 ? (
				<ul
					aria-label="Published project candidates"
					aria-busy={loading || query.isFetching}
					className="max-h-112 scroll-py-2 divide-y overflow-y-auto overscroll-contain rounded-lg border"
				>
					{query.data.projects.map((project) => {
						const added = projects.some(({ id }) => id === project.id),
							website = featuredWebsiteUrl(project.websiteUrl)
						return (
							<li
								key={project.id}
								className="flex flex-wrap items-center gap-3 p-3"
							>
								<ProjectLogo
									src={project.logo}
									name={project.name}
									className="size-9 shrink-0 rounded-lg"
								/>
								<div className="flex min-w-0 flex-1 flex-col gap-1">
									<p className="text-sm font-medium wrap-anywhere">
										{project.name}
									</p>
									<p className="line-clamp-2 text-xs wrap-anywhere text-muted-foreground">
										{project.tagline}
									</p>
									{!website && (
										<Badge variant="outline">Website required</Badge>
									)}
								</div>
								<Button
									variant="outline"
									size="sm"
									disabled={
										disabled ||
										added ||
										!website ||
										projects.length >= MAX_FEATURED_PROJECTS
									}
									aria-label={`Add ${project.name} to featured`}
									onClick={() => onAdd(project)}
								>
									{added ? (
										<IconCheck data-icon="inline-start" />
									) : (
										<IconPlus data-icon="inline-start" />
									)}
									{added ? 'Added' : 'Add'}
								</Button>
							</li>
						)
					})}
				</ul>
			) : (
				<Empty className="border py-8">
					<EmptyHeader>
						<EmptyTitle>No matching projects</EmptyTitle>
						<EmptyDescription>
							Try another name or publish a project first.
						</EmptyDescription>
					</EmptyHeader>
					{search && (
						<Button variant="outline" onClick={onClearSearch}>
							Clear search
						</Button>
					)}
				</Empty>
			)}
			<nav
				aria-label="Project search pagination"
				aria-busy={loading || query.isFetching}
				className="flex flex-wrap items-center justify-between gap-3"
			>
				<span className="text-xs text-muted-foreground">
					Page {page} · {query.data.pagination.totalItems} projects
				</span>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						disabled={disabled || !query.data.pagination.hasPreviousPage}
						className="aria-disabled:opacity-50"
						aria-disabled={
							disabled ||
							loading ||
							query.isFetching ||
							!query.data.pagination.hasPreviousPage
						}
						onClick={() => {
							if (!loading && !query.isFetching) onPageChange(page - 1)
						}}
					>
						Previous
					</Button>
					<Button
						variant="outline"
						size="sm"
						disabled={disabled || !query.data.pagination.hasNextPage}
						className="aria-disabled:opacity-50"
						aria-disabled={
							disabled ||
							loading ||
							query.isFetching ||
							!query.data.pagination.hasNextPage
						}
						onClick={() => {
							if (!loading && !query.isFetching) onPageChange(page + 1)
						}}
					>
						Next
					</Button>
				</div>
			</nav>
		</>
	)
}

function CandidatePending() {
	return (
		<div className="flex flex-col gap-2">
			<output className="sr-only">Loading published projects</output>
			{[0, 1, 2].map((row) => (
				<Skeleton key={row} className="h-18 w-full" />
			))}
		</div>
	)
}

export function FeaturedPending() {
	return (
		<div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
			<output className="sr-only">Loading featured projects</output>
			<Skeleton className="h-8 w-52" />
			<Skeleton className="h-5 w-96 max-w-full" />
			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
				<Skeleton className="h-80 w-full rounded-xl" />
				<Skeleton className="h-96 w-full rounded-xl" />
			</div>
		</div>
	)
}
