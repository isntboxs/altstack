import {
	IconArrowLeft,
	IconArrowRight,
	IconSearch,
	IconX,
} from '@tabler/icons-react'
import { getRouteApi, Link, useRouterState } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import type { z } from 'zod'

import type { ORPCRouterOutputs } from '@altstack/api/routers'

import type { tagSchema } from '@altstack/shared/schemas/tag'
import { tagSortSchema } from '@altstack/shared/schemas/tag'

import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from '@altstack/ui/components/breadcrumb'
import { Button, buttonVariants } from '@altstack/ui/components/button'
import {
	Empty,
	EmptyHeader,
	EmptyTitle,
	EmptyDescription,
} from '@altstack/ui/components/empty'
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from '@altstack/ui/components/input-group'
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@altstack/ui/components/select'
import { Separator } from '@altstack/ui/components/separator'
import { Skeleton } from '@altstack/ui/components/skeleton'

import { FilterSection } from '#/components/filter-section'
import { PublicError } from '#/components/public-page-state'
import { CategoryControlsSkeleton } from '#/components/public-skeletons'

const directoryRoute = getRouteApi('/_app/tags/')
const detailRoute = getRouteApi('/_app/tags/$slug')
const sortItems = [
	{ value: 'popular', label: 'Most Popular' },
	{ value: 'name-asc', label: 'Name (A to Z)' },
	{ value: 'name-desc', label: 'Name (Z to A)' },
]

/** Renders the directory trail and, when provided, the current tag's display name. */
export function TagBreadcrumb({ name }: { name?: string }) {
	return (
		<Breadcrumb>
			<BreadcrumbList>
				<BreadcrumbItem>
					<BreadcrumbLink render={<Link to="/" />}>Home</BreadcrumbLink>
				</BreadcrumbItem>
				<BreadcrumbSeparator />
				<BreadcrumbItem>
					{name ? (
						<BreadcrumbLink render={<Link to="/tags" />}>Tags</BreadcrumbLink>
					) : (
						<BreadcrumbPage>Tags</BreadcrumbPage>
					)}
				</BreadcrumbItem>
				{name && (
					<>
						<BreadcrumbSeparator />
						<BreadcrumbItem>
							<BreadcrumbPage>{name}</BreadcrumbPage>
						</BreadcrumbItem>
					</>
				)}
			</BreadcrumbList>
		</Breadcrumb>
	)
}

/** Keeps debounced search, sorting, and letter filters synchronized with URL history. */
export function TagDirectoryControls() {
	const search = directoryRoute.useSearch()
	const navigate = directoryRoute.useNavigate()
	const [draft, setDraft] = useState(search.q ?? '')
	const submitted = useRef<{ value: string | undefined } | null>(null)
	useEffect(() => {
		if (submitted.current && submitted.current.value === search.q) {
			submitted.current = null
			return
		}
		submitted.current = null
		// oxlint-disable-next-line react-hooks-js/set-state-in-effect -- Keep the input synchronized with browser back/forward and reset.
		setDraft(search.q ?? '')
	}, [search.q])
	useEffect(() => {
		const timer = window.setTimeout(() => {
			const q = draft.trim() || undefined
			if (q !== search.q) {
				submitted.current = { value: q }
				void navigate({
					search: (prev) => {
						return { ...prev, q, page: undefined }
					},
					replace: true,
					resetScroll: false,
				})
			}
		}, 350)
		return () => window.clearTimeout(timer)
	}, [draft, search.q, navigate])
	const active =
		Boolean(draft) ||
		Boolean(search.letter) ||
		Boolean(search.sort) ||
		Boolean(search.page)
	return (
		<div className="container mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pt-28 pb-6 lg:px-16">
			<div className="flex flex-col gap-4">
				<TagBreadcrumb />
				<h1 className="text-3xl font-medium tracking-tight sm:text-4xl">
					Browse Open Source Tags
				</h1>
				<p className="max-w-3xl text-lg leading-7 text-muted-foreground">
					Discover topics to find your best open source software options.
				</p>
			</div>
			<div className="flex flex-col gap-2">
				<div className="flex flex-col gap-2 sm:flex-row">
					<InputGroup className="min-w-0 flex-1">
						<InputGroupAddon>
							<IconSearch />
						</InputGroupAddon>
						<InputGroupInput
							aria-label="Search tags"
							placeholder="Search tags..."
							value={draft}
							maxLength={100}
							onChange={(e) => setDraft(e.target.value)}
						/>
						{active && (
							<InputGroupAddon align="inline-end">
								<InputGroupButton
									onClick={() => {
										setDraft('')
										void navigate({ search: {}, resetScroll: false })
									}}
								>
									<IconX data-icon="inline-start" />
									Reset
								</InputGroupButton>
							</InputGroupAddon>
						)}
					</InputGroup>
					<Select
						items={sortItems}
						value={search.sort ?? 'popular'}
						onValueChange={(value) => {
							const parsed = tagSortSchema.safeParse(value)
							if (parsed.success) {
								void navigate({
									search: (prev) => {
										return {
											...prev,
											sort: parsed.data === 'popular' ? undefined : parsed.data,
											page: undefined,
										}
									},
									resetScroll: false,
								})
							}
						}}
					>
						<SelectTrigger
							aria-label="Order tags by"
							className="w-full sm:w-44"
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								{sortItems.map((item) => (
									<SelectItem key={item.value} value={item.value}>
										{item.label}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
				</div>
				<nav
					aria-label="Filter tags by letter"
					className="flex flex-wrap gap-1"
				>
					{[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '&'].map((letter) => (
						<Link
							key={letter}
							className={buttonVariants({
								variant: search.letter === letter ? 'secondary' : 'outline',
								size: 'sm',
							})}
							to="/tags"
							search={(prev) => {
								return {
									...prev,
									letter: prev.letter === letter ? undefined : letter,
									page: undefined,
								}
							}}
							resetScroll={false}
							aria-current={search.letter === letter ? 'true' : undefined}
							aria-label={
								letter === '&'
									? 'Tags starting with numbers or symbols'
									: `Tags starting with ${letter}`
							}
						>
							{letter}
						</Link>
					))}
				</nav>
			</div>
		</div>
	)
}

/** Displays tag counts and pagination links that retain the current directory filters. */
export function TagDirectoryResults({
	data,
}: {
	data: ORPCRouterOutputs['tag']['list']
}) {
	const { pagination } = data
	const pages = [
		...new Set([
			1,
			pagination.page - 1,
			pagination.page,
			pagination.page + 1,
			pagination.totalPages,
		]),
	].filter((page) => page > 0 && page <= pagination.totalPages)

	return (
		<section
			aria-label="Tag results"
			className="container mx-auto mb-10 flex w-full max-w-6xl flex-col gap-8 px-4 lg:px-16"
		>
			{data.tags.length > 0 ? (
				<ul className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
					{data.tags.map((tag) => (
						<li key={tag.id} className="min-w-0">
							<Link
								to="/tags/$slug"
								params={{ slug: tag.slug }}
								className="group flex min-h-10 items-center gap-4 rounded-sm py-2 focus-visible:outline-2 focus-visible:outline-ring"
							>
								<span className="min-w-0 font-medium wrap-anywhere group-hover:underline">
									{tag.name}
								</span>
								<Separator className="min-w-2 flex-1" />
								<span className="shrink-0 text-xs text-muted-foreground">
									{tag.projectCount}{' '}
									{tag.projectCount === 1 ? 'project' : 'projects'}
								</span>
							</Link>
						</li>
					))}
				</ul>
			) : (
				<Empty>
					<EmptyHeader>
						<EmptyTitle>No tags found</EmptyTitle>
						<EmptyDescription>
							Try another search or letter, or return to the first page.
						</EmptyDescription>
					</EmptyHeader>
					<Link
						className={buttonVariants({ variant: 'outline' })}
						to="/tags"
						activeOptions={{ exact: true, explicitUndefined: true }}
						search={{}}
					>
						Reset filters
					</Link>
				</Empty>
			)}
			{pagination.totalPages > 1 && (
				<nav
					aria-label="Tags pagination"
					className="flex flex-wrap items-center justify-between gap-3 border-t pt-5"
				>
					{pagination.hasPreviousPage ? (
						<Link
							className={buttonVariants({ variant: 'ghost' })}
							to="/tags"
							activeOptions={{ exact: true, explicitUndefined: true }}
							search={(prev) => {
								return {
									...prev,
									page:
										pagination.page - 1 === 1 ? undefined : pagination.page - 1,
								}
							}}
							resetScroll={false}
						>
							<IconArrowLeft data-icon="inline-start" />
							Prev
						</Link>
					) : (
						<Button variant="ghost" disabled>
							<IconArrowLeft data-icon="inline-start" />
							Prev
						</Button>
					)}
					<div className="flex flex-wrap items-center gap-1">
						<span className="mr-1 text-sm text-muted-foreground">Page:</span>
						{pages.map((page, index) => (
							<span key={page} className="flex items-center gap-1">
								{index > 0 && page > (pages[index - 1] ?? 0) + 1 && (
									<span aria-hidden="true">…</span>
								)}
								<Link
									className={buttonVariants({
										variant: page === pagination.page ? 'secondary' : 'ghost',
										size: 'sm',
									})}
									to="/tags"
									activeOptions={{ exact: true, explicitUndefined: true }}
									search={(prev) => {
										return { ...prev, page: page === 1 ? undefined : page }
									}}
									resetScroll={false}
									aria-current={page === pagination.page ? 'page' : undefined}
								>
									{page}
								</Link>
							</span>
						))}
					</div>
					{pagination.hasNextPage ? (
						<Link
							className={buttonVariants({ variant: 'ghost' })}
							to="/tags"
							activeOptions={{ exact: true, explicitUndefined: true }}
							search={(prev) => {
								return {
									...prev,
									page:
										pagination.page + 1 === 1 ? undefined : pagination.page + 1,
								}
							}}
							resetScroll={false}
						>
							Next
							<IconArrowRight data-icon="inline-end" />
						</Link>
					) : (
						<Button variant="ghost" disabled>
							Next
							<IconArrowRight data-icon="inline-end" />
						</Button>
					)}
				</nav>
			)}
		</section>
	)
}

/** Shows tag metadata and project filters while retaining loaded metadata during refetches. */
export function TagProjectControls() {
	const { slug } = detailRoute.useParams()
	const routeData = useRouterState({
		select: (state) =>
			state.matches.find((match) => match.routeId === '/_app/tags/$slug')
				?.loaderData,
	})
	const [data, setData] = useState(routeData)
	if (routeData && data !== routeData) setData(routeData)
	const { q, sort, page } = detailRoute.useSearch()
	const navigate = detailRoute.useNavigate()
	if (!data || data.tag.slug !== slug) return <CategoryControlsSkeleton />
	return (
		<>
			<div className="container mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pt-28 wrap-anywhere lg:px-16">
				<TagBreadcrumb name={data.tag.name} />
				<h1 className="text-3xl font-medium tracking-tight sm:text-4xl">
					Open Source Projects tagged &quot;{data.tag.name}&quot;
				</h1>
				<p className="max-w-3xl text-lg leading-7 text-muted-foreground">
					{data.tag.description ??
						`Explore the best open source projects tagged "${data.tag.name}".`}
				</p>
			</div>
			<FilterSection
				q={q}
				sort={sort}
				page={page}
				placeholder={`Search in "${data.tag.name}"...`}
				onQueryChange={(nextQ) =>
					void navigate({
						search: (prev) => {
							return { ...prev, q: nextQ, page: undefined }
						},
						replace: true,
						resetScroll: false,
					})
				}
				onSortChange={(nextSort) =>
					void navigate({
						search: (prev) => {
							return { ...prev, sort: nextSort, page: undefined }
						},
						resetScroll: false,
					})
				}
				onReset={() => void navigate({ search: {}, resetScroll: false })}
			/>
		</>
	)
}

/** Links a project's visible tags to their catalogues, omitting empty tag sections. */
export function PublicProjectTags({
	tags,
}: {
	tags: Array<z.infer<typeof tagSchema>>
}) {
	if (tags.length === 0) return null
	return (
		<section
			aria-labelledby="project-tags-heading"
			className="flex flex-col gap-3"
		>
			<h2 id="project-tags-heading" className="text-lg font-medium">
				Tags
			</h2>
			<div className="flex flex-wrap gap-x-4 gap-y-2">
				{tags.map((tag) => (
					<Link
						key={tag.id}
						to="/tags/$slug"
						params={{ slug: tag.slug }}
						className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
					>
						<span aria-hidden="true"># </span>
						{tag.name}
					</Link>
				))}
			</div>
		</section>
	)
}
/** Offers the shared retry UI when a tag request fails. */
export function TagsError() {
	return <PublicError title="Unable to load tags" />
}

/** Reserves the directory grid's layout and announces loading to assistive technology. */
export function TagResultsPending() {
	return (
		<section
			aria-label="Tag results"
			aria-busy="true"
			className="container mx-auto mb-10 w-full max-w-6xl px-4 lg:px-16"
		>
			<output className="sr-only">Loading tags…</output>
			<div
				aria-hidden="true"
				className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3"
			>
				{Array.from({ length: 18 }, (_, index) => (
					<Skeleton key={index} className="h-10 w-full" />
				))}
			</div>
		</section>
	)
}
/** Provides directory navigation for missing, hidden, or unassigned public tags. */
export function TagNotFound() {
	return (
		<div className="container mx-auto flex max-w-6xl flex-col gap-4 px-4 pt-28 lg:px-16">
			<h1 className="text-3xl font-medium">Tag not found</h1>
			<p className="text-muted-foreground">
				This tag is unavailable or has no published projects.
			</p>
			<Link to="/tags" className="underline underline-offset-4">
				Browse tags
			</Link>
		</div>
	)
}
