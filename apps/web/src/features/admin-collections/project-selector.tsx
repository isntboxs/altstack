import {
	IconArrowDown,
	IconArrowUp,
	IconCheck,
	IconPlus,
	IconSearch,
	IconX,
} from '@tabler/icons-react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState, useTransition } from 'react'

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
import { Field, FieldLabel } from '@altstack/ui/components/field'
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from '@altstack/ui/components/input-group'
import { Skeleton } from '@altstack/ui/components/skeleton'

import { ProjectLogo } from '#/components/project-media'
import { QueryBoundary } from '#/components/query-boundary'
import { adminProjectQueries } from '#/features/admin-projects/queries'

export type SelectedProject = {
	id: string
	name: string
	logo: string | null
	status: string
}

export function CollectionProjectSelector(
	props: Parameters<typeof ProjectSelector>[0]
) {
	return (
		<QueryBoundary
			pending={<ProjectSearchPending />}
			error={(_, retry) => (
				<Alert variant="destructive">
					<AlertTitle>Unable to load projects</AlertTitle>
					<AlertDescription>
						<p>Please retry to find projects for this collection.</p>
						<Button type="button" variant="outline" onClick={retry}>
							Retry search
						</Button>
					</AlertDescription>
				</Alert>
			)}
		>
			<ProjectSelector {...props} />
		</QueryBoundary>
	)
}

function ProjectSearchPending() {
	return (
		<div className="flex flex-col gap-2">
			<output className="sr-only">Loading projects…</output>
			{[0, 1, 2].map((row) => (
				<Skeleton key={row} className="h-14 w-full" />
			))}
		</div>
	)
}

function ProjectSelector({
	members,
	target,
	needsMainProject,
	busy,
	onMembersChange,
	onTargetChange,
}: {
	members: Array<SelectedProject>
	target: SelectedProject | null
	needsMainProject: boolean
	busy: boolean
	onMembersChange: (members: Array<SelectedProject>) => void
	onTargetChange: (project: SelectedProject) => void
}) {
	const [text, setText] = useState('')
	const [search, setSearch] = useState('')
	const [page, setPage] = useState(1)
	const [changing, startTransition] = useTransition()
	const candidates = useSuspenseQuery({
		...adminProjectQueries.list({
			status: 'published',
			name: search || undefined,
			page,
			limit: 12,
		}),
		retry: false,
	})
	function submitSearch() {
		startTransition(() => {
			setSearch(text.trim())
			setPage(1)
		})
	}
	function clearSearch() {
		setText('')
		startTransition(() => {
			setSearch('')
			setPage(1)
		})
	}
	function move(index: number, delta: number) {
		const next = [...members]
		;[next[index], next[index + delta]] = [next[index + delta], next[index]]
		onMembersChange(next)
	}

	return (
		<div className="flex min-w-0 flex-col gap-5">
			{needsMainProject && (
				<div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
					<p className="text-sm font-medium">Main project</p>
					{target ? (
						<div className="flex min-w-0 items-center gap-2">
							<ProjectLogo
								src={target.logo}
								name={target.name}
								className="size-7 shrink-0"
							/>
							<span className="min-w-0 flex-1 text-sm wrap-anywhere">
								{target.name}
							</span>
							<Badge
								variant={
									target.status === 'published' ? 'secondary' : 'destructive'
								}
							>
								{target.status === 'published' ? 'Selected' : 'Unavailable'}
							</Badge>
						</div>
					) : (
						<p className="text-sm text-muted-foreground">
							Choose “Set main project” from the results below.
						</p>
					)}
					<p className="text-xs text-muted-foreground">
						The project this collection is built around. It stays separate from
						the members.
					</p>
				</div>
			)}
			<section
				aria-labelledby="collection-members-title"
				className="flex min-w-0 flex-col gap-3"
			>
				<div className="flex flex-wrap items-center justify-between gap-2">
					<h3 id="collection-members-title" className="text-sm font-medium">
						Members{' '}
						<span className="text-muted-foreground">
							({members.length}/100)
						</span>
					</h3>
					<span className="text-xs text-muted-foreground">
						Use arrows to reorder
					</span>
				</div>
				{members.length === 0 ? (
					<Empty className="border bg-muted/20 py-6">
						<EmptyHeader>
							<EmptyTitle>No projects added yet</EmptyTitle>
							<EmptyDescription>
								Find a published project below and add it to your collection.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				) : (
					<ol className="divide-y rounded-lg border">
						{members.map((member, index) => (
							<li
								key={member.id}
								className="flex flex-wrap items-center gap-2 p-3"
							>
								<span className="w-5 shrink-0 text-center text-xs text-muted-foreground">
									{index + 1}
								</span>
								<ProjectLogo
									src={member.logo}
									name={member.name}
									className="size-7 shrink-0"
								/>
								<div className="min-w-0 flex-1">
									<p className="text-sm font-medium wrap-anywhere">
										{member.name}
									</p>
									{member.status !== 'published' && (
										<p className="text-xs text-destructive">
											Unavailable. Remove before saving.
										</p>
									)}
								</div>
								<div className="ml-auto flex items-center gap-1">
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										aria-label={`Move ${member.name} up`}
										disabled={busy || index === 0}
										onClick={() => move(index, -1)}
									>
										<IconArrowUp />
									</Button>
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										aria-label={`Move ${member.name} down`}
										disabled={busy || index === members.length - 1}
										onClick={() => move(index, 1)}
									>
										<IconArrowDown />
									</Button>
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										aria-label={`Remove ${member.name}`}
										disabled={busy}
										onClick={() =>
											onMembersChange(members.filter((p) => p.id !== member.id))
										}
									>
										<IconX />
									</Button>
								</div>
							</li>
						))}
					</ol>
				)}
				<p className="text-xs text-muted-foreground">
					Order controls presentation only; it is not a ranking.
				</p>
			</section>
			{members.length >= 100 && (
				<Alert>
					<AlertTitle>Member limit reached</AlertTitle>
					<AlertDescription>
						Remove a member to add another project. A collection can contain up
						to 100 projects.
					</AlertDescription>
				</Alert>
			)}
			<section
				aria-label="Project selector"
				className="flex min-w-0 flex-col gap-3 border-t pt-5"
			>
				<Field>
					<FieldLabel htmlFor="collection-project-search">
						Search published projects
					</FieldLabel>
					<div className="flex gap-2">
						<InputGroup>
							<InputGroupAddon>
								<IconSearch aria-hidden="true" />
							</InputGroupAddon>
							<InputGroupInput
								id="collection-project-search"
								placeholder="Search by project name…"
								value={text}
								disabled={busy}
								onChange={(e) => setText(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === 'Enter') {
										e.preventDefault()
										submitSearch()
									}
								}}
							/>
						</InputGroup>
						<Button
							type="button"
							variant="outline"
							disabled={busy || changing || candidates.isFetching}
							onClick={submitSearch}
						>
							Search
						</Button>
					</div>
				</Field>
				{search && (
					<div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
						<span className="min-w-0 wrap-anywhere">
							Results for “{search}”
						</span>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							disabled={busy}
							onClick={clearSearch}
						>
							Clear search
						</Button>
					</div>
				)}
				{candidates.isError && (
					<Alert variant="destructive">
						<AlertTitle>Unable to load projects</AlertTitle>
						<AlertDescription>
							<p>Please retry to find projects for this collection.</p>
							<Button
								type="button"
								variant="outline"
								onClick={() => void candidates.refetch()}
							>
								Retry search
							</Button>
						</AlertDescription>
					</Alert>
				)}
				<ul
					aria-label="Available projects"
					aria-busy={changing || candidates.isFetching}
					className="max-h-80 scroll-py-2 divide-y overflow-y-auto overscroll-contain rounded-lg border empty:hidden"
				>
					{candidates.data.projects.map((p) => {
						const added = members.some((m) => m.id === p.id)
						const main = target?.id === p.id
						return (
							<li key={p.id} className="flex flex-wrap items-center gap-3 p-3">
								<ProjectLogo
									src={p.logo}
									name={p.name}
									className="size-8 shrink-0"
								/>
								<div className="min-w-0 flex-1">
									<p className="text-sm font-medium wrap-anywhere">{p.name}</p>
									<p className="line-clamp-1 text-xs wrap-anywhere text-muted-foreground">
										{p.description}
									</p>
								</div>
								<div className="ml-auto flex flex-wrap items-center gap-2">
									{needsMainProject && (
										<Button
											type="button"
											variant="ghost"
											size="sm"
											disabled={busy || added || main}
											onClick={() => onTargetChange(p)}
										>
											{main ? 'Main project' : 'Set main project'}
										</Button>
									)}
									<Button
										type="button"
										variant="outline"
										size="sm"
										disabled={busy || members.length >= 100 || added || main}
										onClick={() => onMembersChange([...members, p])}
									>
										{added ? (
											<IconCheck data-icon="inline-start" />
										) : (
											<IconPlus data-icon="inline-start" />
										)}
										{added ? 'Added' : 'Add member'}
									</Button>
								</div>
							</li>
						)
					})}
				</ul>
				{!candidates.isError && candidates.data.projects.length === 0 && (
					<Empty className="border py-6">
						<EmptyHeader>
							<EmptyTitle>No matching projects</EmptyTitle>
							<EmptyDescription>
								Try a different name. Only published projects can be added to a
								collection.
							</EmptyDescription>
						</EmptyHeader>
						{search && (
							<Button type="button" variant="outline" onClick={clearSearch}>
								Clear search
							</Button>
						)}
					</Empty>
				)}
				<div className="flex flex-wrap items-center justify-between gap-3">
					<Link
						to="/submit"
						className="rounded-sm text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
					>
						Submit a missing project
					</Link>
					<nav
						aria-label="Project search pagination"
						aria-busy={changing || candidates.isFetching}
						className="flex items-center gap-2"
					>
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={busy || !candidates.data.pagination.hasPreviousPage}
							className="aria-disabled:opacity-50"
							aria-disabled={
								busy ||
								changing ||
								candidates.isFetching ||
								!candidates.data.pagination.hasPreviousPage
							}
							onClick={() => {
								if (!changing && !candidates.isFetching) {
									startTransition(() => setPage(page - 1))
								}
							}}
						>
							Previous
						</Button>
						<span className="text-xs text-muted-foreground">Page {page}</span>
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={busy || !candidates.data.pagination.hasNextPage}
							className="aria-disabled:opacity-50"
							aria-disabled={
								busy ||
								changing ||
								candidates.isFetching ||
								!candidates.data.pagination.hasNextPage
							}
							onClick={() => {
								if (!changing && !candidates.isFetching) {
									startTransition(() => setPage(page + 1))
								}
							}}
						>
							Next
						</Button>
					</nav>
				</div>
			</section>
		</div>
	)
}
