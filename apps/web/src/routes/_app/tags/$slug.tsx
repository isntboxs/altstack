import {
	createFileRoute,
	Link,
	notFound,
	redirect,
} from '@tanstack/react-router'

import { tagSlugSchema } from '@altstack/shared/schemas/tag'

import { ProjectListSection } from '#/components/project-list-section'
import { PublicPending } from '#/components/public-page-state'
import { tagProjectPageLink } from '#/features/project/page-links'
import { projectQueries } from '#/features/project/queries'
import { projectFilterSearchSchema } from '#/features/project/search'
import { cataloguePolicy, seoHead, unavailableHead } from '#/features/seo/meta'
import { TagNotFound, TagsError } from '#/features/tag/components/public-tag'
import { tagQueries } from '#/features/tag/queries'

export const Route = createFileRoute('/_app/tags/$slug')({
	validateSearch: projectFilterSearchSchema,
	loaderDeps: ({ search: { q, sort, page } }) => {
		return { q, sort, page }
	},
	loader: async ({ context, params, deps }) => {
		const slug = tagSlugSchema.safeParse(params.slug)
		if (!slug.success) throw notFound()
		if (slug.data !== params.slug) {
			throw redirect({
				to: '/tags/$slug',
				params: { slug: slug.data },
				search: deps,
				statusCode: 308,
				replace: true,
			})
		}
		const detail = await context.queryClient
			.query({ ...tagQueries.get(params.slug), retry: false })
			.catch((error: unknown) => {
				if (
					typeof error === 'object' &&
					error !== null &&
					'code' in error &&
					error.code === 'NOT_FOUND'
				) {
					throw notFound()
				}
				throw error
			})
		const projects = await context.queryClient.query(
			projectQueries.search({ ...deps, tag: detail.tag.slug })
		)
		return { ...detail, projects }
	},
	head: ({ loaderData, match }) =>
		loaderData
			? seoHead({
					title: `Open Source Projects tagged "${loaderData.tag.name}" | AltStack`,
					description:
						loaderData.tag.description ??
						`Explore open source projects tagged "${loaderData.tag.name}".`,
					...cataloguePolicy(
						`/tags/${loaderData.tag.slug}`,
						match.search,
						loaderData.projects.pagination.totalPages
					),
				})
			: unavailableHead(),
	pendingMs: 250,
	pendingMinMs: 200,
	pendingComponent: PublicPending,
	errorComponent: TagsError,
	notFoundComponent: TagNotFound,
	component: TagProjects,
})

function TagProjects() {
	const { tag, projects } = Route.useLoaderData()
	return (
		<ProjectListSection
			data={projects}
			emptyMessage="No projects match your current filters. Try a different search or clear the filters."
			emptyAction={
				<Link
					to="/tags/$slug"
					params={{ slug: tag.slug }}
					search={{}}
					className="underline underline-offset-4"
				>
					Clear filters
				</Link>
			}
			pageLinkOptions={(page) => tagProjectPageLink(tag.slug, page)}
		/>
	)
}
