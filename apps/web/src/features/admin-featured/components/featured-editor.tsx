import { IconArrowDown, IconArrowUp } from '@tabler/icons-react'
import {
	useMutation,
	useQueryClient,
	useSuspenseQuery,
} from '@tanstack/react-query'
import { CatchBoundary, Link } from '@tanstack/react-router'
import { Suspense, useState } from 'react'

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
import { Badge } from '@altstack/ui/components/badge'
import { Button } from '@altstack/ui/components/button'
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from '@altstack/ui/components/empty'
import { Field, FieldGroup, FieldLabel } from '@altstack/ui/components/field'
import { Input } from '@altstack/ui/components/input'
import { Skeleton } from '@altstack/ui/components/skeleton'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@altstack/ui/components/table'
import { toast } from '@altstack/ui/components/toast'

import { ProjectLogo } from '#/components/project-media'
import { adminFeaturedQueries } from '#/features/admin-featured/queries'
import { adminProjectQueries } from '#/features/admin-projects/queries'
import { invalidateCatalog } from '#/utils/invalidate-catalog'
import { adminORPC } from '#/utils/orpc'

type Selection = ORPCRouterOutputs['admin']['featured']['list']['projects']

export function FeaturedEditor() {
	const { data } = useSuspenseQuery(adminFeaturedQueries.list())
	return <SelectionEditor initial={data.projects} />
}

function SelectionEditor({ initial }: { initial: Selection }) {
	const queryClient = useQueryClient()
	const [projects, setProjects] = useState(initial)
	const [baseline, setBaseline] = useState(initial.map(({ id }) => id))
	const [error, setError] = useState<{
		operation: 'save' | 'reload'
		message: string
	} | null>(null)
	const [reloading, setReloading] = useState(false)
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
	async function reload() {
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
			const next = [...previous]
			const target = index + delta
			if (target < 0 || target >= next.length) return previous
			;[next[index], next[target]] = [next[target], next[index]]
			return next
		})
	}
	return (
		<div className="mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-6 px-4 py-6">
			<div className="flex flex-col gap-2">
				<h1 className="text-xl font-semibold">Featured Projects</h1>
				<p className="text-sm text-muted-foreground">
					Choose up to {MAX_FEATURED_PROJECTS} projects for the panel on project
					detail pages. Only published projects with a website appear. The
					current project is excluded automatically.
				</p>
			</div>
			{error && (
				<Alert variant="destructive">
					<AlertTitle>
						{error.operation === 'save'
							? 'Unable to save changes'
							: 'Unable to reload selection'}
					</AlertTitle>
					<AlertDescription>{error.message}</AlertDescription>
				</Alert>
			)}
			<section
				className="flex min-w-0 flex-col gap-4"
				aria-labelledby="featured-selection-title"
			>
				<div className="flex flex-wrap items-center justify-between gap-3">
					<h2 id="featured-selection-title" className="font-medium">
						Selected projects ({projects.length}/{MAX_FEATURED_PROJECTS})
					</h2>
					<div className="flex flex-wrap gap-2">
						<Button
							variant="outline"
							disabled={busy}
							onClick={() => void reload()}
						>
							{dirty ? 'Discard changes and reload' : 'Reload selection'}
						</Button>
						<Button
							disabled={busy || !dirty}
							onClick={() =>
								save.mutate({
									body: {
										projectIds: projects.map(({ id }) => id),
										expectedProjectIds: baseline,
									},
								})
							}
						>
							{save.isPending ? 'Saving…' : 'Save changes'}
						</Button>
					</div>
				</div>
				{projects.length > 0 ? (
					<Table aria-label="Featured selection">
						<TableHeader>
							<TableRow>
								<TableHead>Order</TableHead>
								<TableHead>Project</TableHead>
								<TableHead>Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{projects.map((project, index) => (
								<TableRow key={project.id}>
									<TableCell>{index + 1}</TableCell>
									<TableCell>
										<div className="flex items-center gap-2">
											<ProjectLogo
												src={project.logo}
												name={project.name}
												className="size-7"
											/>
											<Link
												to="/projects/$id/edit"
												params={{ id: project.id }}
												className="underline underline-offset-4"
											>
												{project.name}
											</Link>
										</div>
										{(project.status !== 'published' ||
											!featuredWebsiteUrl(project.websiteUrl)) && (
											<Badge variant="secondary">
												Unavailable — remove before saving
											</Badge>
										)}
									</TableCell>
									<TableCell>
										<div className="flex gap-2">
											<Button
												variant="outline"
												size="icon"
												aria-label={`Move ${project.name} up`}
												disabled={busy || index === 0}
												onClick={() => move(index, -1)}
											>
												<IconArrowUp />
											</Button>
											<Button
												variant="outline"
												size="icon"
												aria-label={`Move ${project.name} down`}
												disabled={busy || index === projects.length - 1}
												onClick={() => move(index, 1)}
											>
												<IconArrowDown />
											</Button>
											<Button
												variant="outline"
												disabled={busy}
												aria-label={`Remove ${project.name} from featured`}
												onClick={() =>
													setProjects((previous) =>
														previous.filter(({ id }) => id !== project.id)
													)
												}
											>
												Remove
											</Button>
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				) : (
					<Empty>
						<EmptyHeader>
							<EmptyTitle>No featured projects selected</EmptyTitle>
							<EmptyDescription>
								Add projects below, then save the selection.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				)}
			</section>
			<section
				className="flex min-w-0 flex-col gap-4"
				aria-labelledby="featured-candidates-title"
			>
				<h2 id="featured-candidates-title" className="font-medium">
					Add projects
				</h2>
				<form
					onSubmit={(event) => {
						event.preventDefault()
						setSearch(text.trim())
						setPage(1)
					}}
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="featured-search">
								Search published projects
							</FieldLabel>
							<div className="flex gap-2">
								<Input
									id="featured-search"
									value={text}
									onChange={(event) => setText(event.target.value)}
								/>
								<Button variant="outline" type="submit">
									Search
								</Button>
							</div>
						</Field>
					</FieldGroup>
				</form>
				<CatchBoundary
					getResetKey={() => `${search}:${page}`}
					errorComponent={({ reset }) => (
						<Alert variant="destructive">
							<AlertTitle>Unable to load projects</AlertTitle>
							<AlertDescription>
								<p>
									Your selected projects have been kept. Check your session and
									retry the search.
								</p>
								<Button
									variant="outline"
									onClick={() => {
										void queryClient
											.resetQueries({ queryKey: adminORPC.project.list.key() })
											.then(() => reset())
									}}
								>
									Retry project search
								</Button>
							</AlertDescription>
						</Alert>
					)}
				>
					<Suspense fallback={<FeaturedPending />}>
						<Candidates
							search={search}
							page={page}
							onPageChange={setPage}
							projects={projects}
							disabled={busy}
							onAdd={(project) =>
								setProjects((previous) =>
									previous.some(({ id }) => id === project.id) ||
									previous.length >= MAX_FEATURED_PROJECTS
										? previous
										: [...previous, project]
								)
							}
						/>
					</Suspense>
				</CatchBoundary>
			</section>
		</div>
	)
}

function Candidates({
	search,
	page,
	onPageChange,
	projects,
	disabled,
	onAdd,
}: {
	search: string
	page: number
	onPageChange: (page: number) => void
	projects: Selection
	disabled: boolean
	onAdd: (project: Selection[number]) => void
}) {
	const { data } = useSuspenseQuery({
		...adminProjectQueries.list({
			status: 'published',
			name: search || undefined,
			page,
			limit: 12,
		}),
		retry: false,
	})
	return (
		<>
			{data.projects.length > 0 ? (
				<Table aria-label="Published project candidates">
					<TableHeader>
						<TableRow>
							<TableHead>Project</TableHead>
							<TableHead>Tagline</TableHead>
							<TableHead>Action</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{data.projects.map((project) => {
							const added = projects.some(({ id }) => id === project.id)
							const website = featuredWebsiteUrl(project.websiteUrl)
							return (
								<TableRow key={project.id}>
									<TableCell>
										<div className="flex items-center gap-2">
											<ProjectLogo
												src={project.logo}
												name={project.name}
												className="size-7"
											/>
											<span>{project.name}</span>
										</div>
										{!website && (
											<Badge variant="secondary">Website required</Badge>
										)}
									</TableCell>
									<TableCell className="max-w-80 whitespace-normal">
										{project.tagline}
									</TableCell>
									<TableCell>
										<Button
											variant="outline"
											disabled={
												disabled ||
												added ||
												!website ||
												projects.length >= MAX_FEATURED_PROJECTS
											}
											aria-label={`Add ${project.name} to featured`}
											onClick={() => onAdd(project)}
										>
											{added ? 'Added' : 'Add'}
										</Button>
									</TableCell>
								</TableRow>
							)
						})}
					</TableBody>
				</Table>
			) : (
				<Empty>
					<EmptyHeader>
						<EmptyTitle>No matching projects</EmptyTitle>
						<EmptyDescription>
							Try another name or publish a project first.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			)}
			<div className="flex items-center justify-end gap-3">
				<span className="mr-auto text-sm text-muted-foreground">
					Page {page} · {data.pagination.totalItems} projects
				</span>
				<Button
					variant="outline"
					disabled={!data.pagination.hasPreviousPage}
					onClick={() => onPageChange(page - 1)}
				>
					Previous
				</Button>
				<Button
					variant="outline"
					disabled={!data.pagination.hasNextPage}
					onClick={() => onPageChange(page + 1)}
				>
					Next
				</Button>
			</div>
		</>
	)
}

export function FeaturedPending() {
	return (
		<output
			aria-label="Loading featured projects"
			className="flex flex-col gap-3"
		>
			<Skeleton className="h-12 w-full" />
			<Skeleton className="h-48 w-full" />
		</output>
	)
}
