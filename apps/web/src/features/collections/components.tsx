import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'

import type { ORPCRouterOutputs } from '@altstack/api/routers'

import { collectionKindLabels } from '@altstack/shared/schemas/collection'
import { featuredWebsiteUrl } from '@altstack/shared/schemas/featured'

import { Badge } from '@altstack/ui/components/badge'
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from '@altstack/ui/components/breadcrumb'
import { buttonVariants } from '@altstack/ui/components/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@altstack/ui/components/card'

import { ProjectLogo, ProjectScreenshot } from '#/components/project-media'
import { PublicContent } from '#/components/public-content'
import { ShareButtons } from '#/components/share-buttons'

type Collection = ORPCRouterOutputs['collection']['getBySlug']
type CollectionCardData =
	ORPCRouterOutputs['collection']['list']['collections'][number]
export const memberAnchor = (id: string) => `project-${id}`

export function CollectionBreadcrumb({ name }: { name?: string }) {
	return (
		<Breadcrumb>
			<BreadcrumbList>
				<BreadcrumbItem className="min-w-0 wrap-anywhere">
					<BreadcrumbLink render={<Link to="/" />}>Home</BreadcrumbLink>
				</BreadcrumbItem>
				<BreadcrumbSeparator />
				<BreadcrumbItem className="min-w-0 wrap-anywhere">
					{name ? (
						<BreadcrumbLink render={<Link to="/collections" />}>
							Collections
						</BreadcrumbLink>
					) : (
						<BreadcrumbPage>Collections</BreadcrumbPage>
					)}
				</BreadcrumbItem>
				{name && (
					<>
						<BreadcrumbSeparator />
						<BreadcrumbItem className="min-w-0 wrap-anywhere">
							<BreadcrumbPage>{name}</BreadcrumbPage>
						</BreadcrumbItem>
					</>
				)}
			</BreadcrumbList>
		</Breadcrumb>
	)
}

export function CollectionCards({
	collections,
}: {
	collections: Array<CollectionCardData>
}) {
	return (
		<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{collections.map((item) => (
				<article
					key={item.id}
					data-slot="collection-card"
					className="group relative min-w-0 rounded-xl p-0.5 ring-1 ring-border transition-colors hover:ring-primary/50"
				>
					<Card className="relative isolate size-full overflow-hidden ring-0">
						<CollectionCardBackground logo={item.logo} name={item.name} />
						<CardHeader className="gap-4">
							<CardTitle className="flex min-w-0 items-start gap-2">
								<ProjectLogo
									src={item.logo}
									name={item.name}
									className="size-7"
								/>
								<h2 className="min-w-0 text-xl font-semibold wrap-anywhere">
									<Link
										to="/collections/$slug"
										params={{ slug: item.slug }}
										className="after:absolute after:inset-0 after:z-10 after:rounded-xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-ring"
									>
										{item.name}
									</Link>
								</h2>
							</CardTitle>
						</CardHeader>
						<CardContent className="relative flex-1">
							<CardDescription>{item.description}</CardDescription>
						</CardContent>
						<CardFooter className="relative flex flex-wrap gap-2">
							<Badge variant="secondary">
								{collectionKindLabels[item.kind]}
							</Badge>
							<span className="text-sm text-muted-foreground">
								{item.memberCount}{' '}
								{item.memberCount === 1 ? 'project' : 'projects'}
							</span>
						</CardFooter>
					</Card>
				</article>
			))}
		</div>
	)
}

function CollectionCardBackground({
	logo,
	name,
}: {
	logo: string | null
	name: string
}) {
	if (!logo) return null
	return (
		<div
			aria-hidden="true"
			className="pointer-events-none absolute -top-10 -right-10 -z-10 rotate-12 mask-[linear-gradient(to_bottom,black_45%,transparent)] opacity-15 blur-xs"
		>
			<ProjectLogo src={logo} name={name} className="size-48" />
		</div>
	)
}

function MainProjectCard({
	project,
}: {
	project: NonNullable<Collection['mainProject']>
}) {
	const url =
		featuredWebsiteUrl(project.websiteUrl) ??
		featuredWebsiteUrl(project.repositoryUrl)
	return (
		<Card
			data-testid="collection-target"
			className="relative isolate hidden self-start lg:flex"
		>
			<CollectionCardBackground logo={project.logo} name={project.name} />
			<CardHeader className="relative">
				<CardTitle className="flex items-center gap-3">
					<ProjectLogo
						src={project.logo}
						name={project.name}
						className="size-9"
					/>
					<Link to="/$slug" params={{ slug: project.slug }}>
						{project.name}
					</Link>
				</CardTitle>
				<CardDescription>{project.description}</CardDescription>
			</CardHeader>
			{url && (
				<CardFooter className="relative">
					<a
						href={url}
						target="_blank"
						rel="noopener noreferrer"
						className={buttonVariants({
							variant: 'outline',
							className: 'w-full',
						})}
					>
						Visit {project.name}
						<span className="sr-only"> (opens in a new tab)</span>
					</a>
				</CardFooter>
			)}
		</Card>
	)
}
export function CollectionArticle({ collection }: { collection: Collection }) {
	return (
		<div className="collection-page container mx-auto w-full max-w-6xl px-4 pt-28 pb-10 lg:px-16">
			<CollectionBreadcrumb name={collection.name} />
			<div className="mt-4 grid min-w-0 gap-8 lg:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)]">
				<header className="flex min-w-0 flex-col gap-4">
					<Badge variant="secondary">
						{collectionKindLabels[collection.kind]}
					</Badge>
					<h1 className="text-3xl font-semibold tracking-tight wrap-anywhere sm:text-4xl">
						{collection.name}
					</h1>
					<p className="text-lg text-muted-foreground">
						{collection.description}
					</p>
					{collection.content && (
						<PublicContent
							slug={`collections/${collection.slug}`}
							content={collection.content}
						/>
					)}
					{collection.sourceRepositoryUrl && (
						<a
							href={collection.sourceRepositoryUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="w-fit underline underline-offset-4"
						>
							Source repository
							<span className="sr-only"> (opens in a new tab)</span>
						</a>
					)}
					<div className="flex flex-col gap-1 text-sm text-muted-foreground">
						<span>Written by {collection.authorName}</span>
						<span>
							Updated{' '}
							<time dateTime={collection.updatedAt.toISOString()}>
								{new Intl.DateTimeFormat('en', {
									dateStyle: 'long',
									timeZone: 'UTC',
								}).format(collection.updatedAt)}
							</time>
						</span>
					</div>
				</header>
				{collection.mainProject && (
					<MainProjectCard project={collection.mainProject} />
				)}
			</div>
			<div
				data-testid="collection-article-region"
				className="mt-10 grid min-w-0 items-stretch gap-8 lg:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)]"
			>
				<article aria-label="Collection projects" className="min-w-0">
					{collection.projects.map((project, index) => (
						<section
							key={project.id}
							id={memberAnchor(project.id)}
							aria-labelledby={`${memberAnchor(project.id)}-title`}
							className="collection-member relative mb-12 flex min-w-0 scroll-mt-12 flex-col gap-6 pb-4"
						>
							<h2
								id={`${memberAnchor(project.id)}-title`}
								tabIndex={-1}
								className="collection-member-heading sticky top-12 z-40 flex min-w-0 items-center gap-3 bg-background/95 py-4 text-2xl font-semibold backdrop-blur-sm focus-visible:outline-2 focus-visible:outline-ring"
							>
								<span
									aria-label={`Sequence ${index + 1}`}
									className="text-muted-foreground"
								>
									{index + 1}.
								</span>
								<ProjectLogo
									src={project.logo}
									name={project.name}
									className="size-8"
								/>
								<span className="min-w-0 wrap-anywhere">{project.name}</span>
							</h2>
							<p className="text-lg text-muted-foreground">
								{project.description}
							</p>
							<ProjectScreenshot
								src={project.screenshot}
								name={project.name}
								websiteUrl={featuredWebsiteUrl(project.websiteUrl)}
							/>
							{project.content && (
								<div
									className="relative max-h-96 overflow-hidden"
									data-testid="collection-content-preview"
								>
									<div inert>
										<PublicContent
											slug={project.slug}
											content={project.content}
										/>
									</div>
									<div
										aria-hidden="true"
										className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-linear-to-t from-background to-transparent"
									/>
								</div>
							)}
							<Link
								to="/$slug"
								params={{ slug: project.slug }}
								className={buttonVariants({
									variant: 'outline',
									className: 'w-fit',
								})}
							>
								Read more<span className="sr-only"> about {project.name}</span>
							</Link>
						</section>
					))}
					<ShareButtons />
				</article>
				<MemberNavigation projects={collection.projects} />
			</div>
		</div>
	)
}
export function MemberNavigation({
	projects,
}: {
	projects: Collection['projects']
}) {
	const navigate = useNavigate()
	const [active, setActive] = useState(projects[0]?.id)
	const list = useRef<HTMLOListElement>(null)
	useEffect(() => {
		let frame = 0
		const update = () => {
			frame = 0
			let current = projects[0]?.id
			for (const project of projects) {
				const section = document.getElementById(memberAnchor(project.id))
				if (section && section.getBoundingClientRect().top <= 65) {
					current = project.id
				}
			}
			setActive(current)
		}
		const schedule = () => {
			if (!frame) frame = requestAnimationFrame(update)
		}
		update()
		window.addEventListener('scroll', schedule, { passive: true })
		window.addEventListener('resize', schedule)
		return () => {
			cancelAnimationFrame(frame)
			window.removeEventListener('scroll', schedule)
			window.removeEventListener('resize', schedule)
		}
	}, [projects])
	useEffect(() => {
		const container = list.current
		const item = container?.querySelector<HTMLElement>(
			'[aria-current="location"]'
		)
		if (!container || !item) return
		// Scroll only the internal list; scrollIntoView can move the article too.
		const outer = container.getBoundingClientRect(),
			inner = item.getBoundingClientRect()
		if (inner.top < outer.top) container.scrollTop -= outer.top - inner.top
		else if (inner.bottom > outer.bottom) {
			container.scrollTop += inner.bottom - outer.bottom
		}
	}, [active])
	return (
		<aside
			className="hidden min-w-0 lg:block"
			data-testid="collection-navigation"
		>
			<nav
				aria-label="Collection projects"
				className="sticky top-16 z-40 flex max-h-[calc(100dvh-5rem)] flex-col gap-4"
			>
				<ol
					ref={list}
					className="flex min-h-0 flex-col gap-1 overflow-y-auto overscroll-contain p-1"
				>
					{projects.map((project, index) => (
						<li key={project.id}>
							<a
								href={`#${memberAnchor(project.id)}`}
								aria-current={active === project.id ? 'location' : undefined}
								className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring aria-[current=location]:bg-muted aria-[current=location]:font-medium aria-[current=location]:text-foreground"
								onClick={(event) => {
									if (
										event.button !== 0 ||
										event.metaKey ||
										event.ctrlKey ||
										event.shiftKey ||
										event.altKey
									) {
										return
									}
									event.preventDefault()
									const section = document.getElementById(
										memberAnchor(project.id)
									)
									if (!section) return
									void navigate({
										hash: memberAnchor(project.id),
										replace: true,
										resetScroll: false,
										hashScrollIntoView: false,
									})
									section.scrollIntoView({
										block: 'start',
										behavior: window.matchMedia(
											'(prefers-reduced-motion: reduce)'
										).matches
											? 'instant'
											: 'smooth',
									})
									document
										.getElementById(`${memberAnchor(project.id)}-title`)
										?.focus({ preventScroll: true })
									setActive(project.id)
								}}
							>
								<span className="text-muted-foreground">{index + 1}.</span>
								<ProjectLogo
									src={project.logo}
									name={project.name}
									className="size-5"
								/>
								<span className="min-w-0 wrap-anywhere">{project.name}</span>
							</a>
						</li>
					))}
				</ol>
				<div className="flex shrink-0 flex-col gap-2 px-3 pb-2">
					<p className="text-sm text-muted-foreground">Missing a project?</p>
					<Link to="/submit" className={buttonVariants({ variant: 'outline' })}>
						Submit a project
					</Link>
				</div>
			</nav>
		</aside>
	)
}
