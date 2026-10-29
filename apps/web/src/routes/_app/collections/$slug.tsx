import { createFileRoute, notFound } from '@tanstack/react-router'

import {
	ProjectPending,
	PublicError,
	PublicNotFound,
} from '#/components/public-page-state'
import {
	CollectionArticle,
	CollectionCards,
} from '#/features/collections/components'
import { collectionQueries } from '#/features/collections/queries'
import { publicUrl, seoHead, unavailableHead } from '#/features/seo/meta'

export const Route = createFileRoute('/_app/collections/$slug')({
	shouldReload: ({ cause }) => cause !== 'stay',
	loader: async ({ context, params }) => {
		try {
			const collection = await context.queryClient.query({
				...collectionQueries.bySlug(params.slug),
				retry: false,
			})
			const others = await context.queryClient.query(
				collectionQueries.list(1, 4)
			)
			return {
				collection,
				others: others.collections
					.filter((item) => item.id !== collection.id)
					.slice(0, 3),
			}
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
		loaderData
			? seoHead({
					title: `${loaderData.collection.name} | AltStack`,
					description: loaderData.collection.description,
					path: `/collections/${loaderData.collection.slug}`,
					entities: [
						{
							'@type': 'CollectionPage',
							name: loaderData.collection.name,
							description: loaderData.collection.description,
							url: publicUrl(`/collections/${loaderData.collection.slug}`),
							dateModified: loaderData.collection.updatedAt.toISOString(),
							author: {
								'@type': 'Person',
								name: loaderData.collection.authorName,
							},
							hasPart: loaderData.collection.projects.map((project) => {
								return {
									'@type': 'SoftwareApplication',
									name: project.name,
									url: publicUrl(`/${project.slug}`),
								}
							}),
						},
					],
				})
			: unavailableHead(),
	notFoundComponent: () => <PublicNotFound title="Collection not found" />,
	pendingMs: 250,
	pendingMinMs: 200,
	pendingComponent: ProjectPending,
	errorComponent: () => <PublicError title="Unable to load collection" />,
	component: Page,
})
function Page() {
	const { collection, others } = Route.useLoaderData()
	return (
		<>
			<CollectionArticle key={collection.id} collection={collection} />
			{others.length > 0 && (
				<section
					aria-label="More collections"
					className="container mx-auto flex max-w-6xl flex-col gap-6 px-4 pt-8 pb-16 lg:px-16"
				>
					<h2 className="text-2xl font-semibold">More collections</h2>
					<CollectionCards collections={others} />
				</section>
			)}
		</>
	)
}
