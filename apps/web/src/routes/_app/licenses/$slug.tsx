import {
	createFileRoute,
	Link,
	notFound,
	redirect,
} from '@tanstack/react-router'

import { licenseSlugSchema } from '@altstack/shared/schemas/license'

import { ProjectListSection } from '#/components/project-list-section'
import { PublicPending } from '#/components/public-page-state'
import {
	LicenseNotFound,
	LicensesError,
} from '#/features/license/components/public-license'
import { licenseQueries } from '#/features/license/queries'
import { licenseProjectPageLink } from '#/features/project/page-links'
import { projectQueries } from '#/features/project/queries'
import { projectFilterSearchSchema } from '#/features/project/search'
import { cataloguePolicy, seoHead, unavailableHead } from '#/features/seo/meta'

export const Route = createFileRoute('/_app/licenses/$slug')({
	validateSearch: projectFilterSearchSchema,
	loaderDeps: ({ search: { q, sort, page } }) => {
		return { q, sort, page }
	},
	loader: async ({ context, params, deps }) => {
		const slug = licenseSlugSchema.safeParse(params.slug)
		if (!slug.success) throw notFound()
		if (slug.data !== params.slug) {
			throw redirect({
				to: '/licenses/$slug',
				params: { slug: slug.data },
				search: deps,
				statusCode: 308,
				replace: true,
			})
		}
		const detail = await context.queryClient
			.query({ ...licenseQueries.get(params.slug), retry: false })
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
			projectQueries.search({ ...deps, license: detail.license.slug })
		)
		return { ...detail, projects }
	},
	head: ({ loaderData, match }) => {
		if (!loaderData) return unavailableHead()
		const policy = cataloguePolicy(
			`/licenses/${loaderData.license.slug}`,
			match.search,
			loaderData.projects.pagination.totalPages
		)
		return seoHead({
			title: `${loaderData.license.slug === 'unknown' ? 'Projects with unknown License' : loaderData.license.identifier + ' Licensed Open Source Software'}${policy.pageSuffix} | AltStack`,
			description: `Explore ${loaderData.license.projectCount} published projects with ${loaderData.license.identifier} license.`,
			...policy,
			noindex: policy.noindex || loaderData.license.slug === 'unknown',
		})
	},
	pendingMs: 250,
	pendingMinMs: 200,
	pendingComponent: PublicPending,
	errorComponent: LicensesError,
	notFoundComponent: LicenseNotFound,
	component: LicenseProjects,
})

/** Renders the loaded license's project catalogue with scoped pagination and filter recovery. */
function LicenseProjects() {
	const { license, projects } = Route.useLoaderData()
	return (
		<ProjectListSection
			data={projects}
			emptyMessage="No projects match your current filters. Try a different search or clear the filters."
			emptyAction={
				<Link
					to="/licenses/$slug"
					params={{ slug: license.slug }}
					search={{}}
					className="underline underline-offset-4"
				>
					Clear filters
				</Link>
			}
			pageLinkOptions={(page) => licenseProjectPageLink(license.slug, page)}
		/>
	)
}
