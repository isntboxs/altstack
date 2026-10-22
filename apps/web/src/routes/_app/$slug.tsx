import { IconBrandGithub } from '@tabler/icons-react'
import { createFileRoute, notFound } from '@tanstack/react-router'
import { useMemo } from 'react'
import { SquareBottomUp } from 'reicon-react'

import { buttonVariants } from '@altstack/ui/components/button'

import { ProjectLogo, ProjectScreenshot } from '#/components/project-media'
import { ProjectContent } from '#/components/public-content'
import {
	ProjectPending,
	PublicError,
	PublicNotFound,
} from '#/components/public-page-state'
import { ShareButtons } from '#/components/share-buttons'
import { PublicProjectCategories } from '#/features/category/components/public-category'
import { ProjectSidebar } from '#/features/project/components/featured-projects'
import { ProjectActions } from '#/features/project/components/project-actions'
import { projectDialogSearch } from '#/features/project/embed/badge'
import { projectQueries, useProjectBySlug } from '#/features/project/queries'
import { publicContentOptions } from '#/features/public-content/queries'
import { unavailableHead } from '#/features/seo/meta'
import { projectHead } from '#/features/seo/project-meta'
import { PublicProjectTags } from '#/features/tag/components/public-tag'

export const Route = createFileRoute('/_app/$slug')({
	validateSearch: projectDialogSearch,
	// Search-only transitions have no data dependencies. Invalidation and a new
	// slug still load normally; opening/closing a dialog leaves detail data alone.
	shouldReload: ({ cause }) => cause !== 'stay',
	loader: async ({ context, params }) => {
		try {
			const project = await context.queryClient.query({
				...projectQueries.bySlug(params.slug),
				retry: false,
			})
			if (project.content) {
				await context.queryClient.query(
					publicContentOptions(params.slug, project.content)
				)
			}
			return { project, statisticsNow: Date.now() }
		} catch (error) {
			if (
				typeof error === 'object' &&
				error !== null &&
				'code' in error &&
				error.code === 'NOT_FOUND'
			) {
				throw notFound()
			}
			throw error
		}
	},
	head: ({ loaderData }) =>
		loaderData ? projectHead(loaderData.project) : unavailableHead(),
	pendingMs: 250,
	pendingMinMs: 200,
	pendingComponent: ProjectPending,
	notFoundComponent: () => <PublicNotFound title="Project not found" />,
	errorComponent: () => <PublicError title="Unable to load project" />,
	component: RouteComponent,
})

function RouteComponent() {
	const { auth } = Route.useRouteContext()
	const { slug } = Route.useParams()
	const { dialog } = Route.useSearch()
	const navigate = Route.useNavigate()
	const { statisticsNow } = Route.useLoaderData()
	const { data: projectData } = useProjectBySlug(slug)

	const safeWebsiteUrl = useMemo(() => {
		try {
			if (!projectData.websiteUrl) return null
			const u = new URL(projectData.websiteUrl)
			return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null
		} catch {
			return null
		}
	}, [projectData.websiteUrl])

	return (
		<div className="container mx-auto w-full max-w-6xl px-6 pt-22 pb-10 lg:px-16">
			<section
				aria-label="Project details"
				className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)]"
			>
				<article className="flex min-w-0 flex-col gap-8 self-start">
					<header className="sticky top-12 z-40 flex w-full items-center justify-between bg-background/95 py-4 backdrop-blur-sm">
						<div className="flex min-w-0 items-center gap-3">
							<ProjectLogo
								src={projectData.logo}
								name={projectData.name}
								className="size-7.5"
							/>
							<h1 className="min-w-0 text-3xl font-bold wrap-anywhere">
								{projectData.name}
							</h1>
						</div>

						<ProjectActions
							key={slug}
							projectId={projectData.id}
							userId={auth?.user.id}
							slug={slug}
							name={projectData.name}
							reportOpen={dialog === 'report'}
							onReportOpenChange={(open) => {
								void navigate({
									search: (previous) => {
										return {
											...previous,
											dialog: open
												? 'report'
												: previous.dialog === 'report'
													? undefined
													: previous.dialog,
										}
									},
									resetScroll: false,
									hash: true,
								})
							}}
							embedOpen={dialog === 'embed'}
							onEmbedOpenChange={(open) => {
								void navigate({
									search: (previous) => {
										return {
											...previous,
											dialog: open ? 'embed' : undefined,
										}
									},
									resetScroll: false,
									hash: true,
								})
							}}
						/>
					</header>

					<div className="-mt-8 space-y-4">
						<p className="text-lg leading-7 text-muted-foreground">
							{projectData.description}
						</p>

						<div className="flex flex-wrap items-center gap-3">
							<a
								href={projectData.repositoryUrl}
								target="_blank"
								rel="noopener noreferrer"
								className={buttonVariants({
									variant: 'outline',
									size: 'lg',
									className: '',
								})}
							>
								<IconBrandGithub /> Visit GitHub
								<span className="sr-only"> (opens in a new tab)</span>
							</a>
							{safeWebsiteUrl && (
								<a
									href={safeWebsiteUrl}
									target="_blank"
									rel="noopener noreferrer"
									className={buttonVariants({
										size: 'lg',
										className: '',
									})}
								>
									Visit Website <SquareBottomUp />
									<span className="sr-only"> (opens in a new tab)</span>
								</a>
							)}
						</div>
					</div>

					<ProjectScreenshot
						src={projectData.screenshot}
						name={projectData.name}
						websiteUrl={safeWebsiteUrl}
					/>

					{projectData.content && (
						<ProjectContent slug={slug} content={projectData.content} />
					)}

					<PublicProjectCategories categories={projectData.categoryDetails} />
					<PublicProjectTags tags={projectData.tags} />

					<ShareButtons />
				</article>

				<ProjectSidebar
					projects={projectData.featuredProjects}
					github={projectData.github}
					history={projectData.githubStarsHistory}
					now={statisticsNow}
				/>
			</section>
		</div>
	)
}
