import { createFileRoute } from '@tanstack/react-router'

import { PublicError, PublicPending } from '#/components/public-page-state'
import { AboutArticle } from '#/features/about/article'
import { aboutQueries } from '#/features/about/queries'
import { publicContentOptions } from '#/features/public-content/queries'
import { seoHead, unavailableHead, publicUrl } from '#/features/seo/meta'

export const Route = createFileRoute('/_app/about')({
	loader: async ({ context }) => {
		const page = await context.queryClient.query({
			...aboutQueries.get(),
			staleTime: 0,
		})
		const prepared = await context.queryClient.query(
			publicContentOptions('about', page.content, 'about')
		)
		return { ...page, prepared }
	},
	head: ({ loaderData }) =>
		loaderData
			? seoHead({
					title: `${loaderData.title} | AltStack`,
					description: loaderData.description,
					path: '/about',
					entities: [
						{
							'@type': 'AboutPage',
							name: loaderData.title,
							description: loaderData.description,
							url: publicUrl('/about'),
						},
					],
				})
			: unavailableHead(),
	pendingMs: 250,
	pendingMinMs: 200,
	pendingComponent: PublicPending,
	errorComponent: () => <PublicError title="Unable to load About us" />,
	component: Page,
})

function Page() {
	const page = Route.useLoaderData()
	return <AboutArticle page={page} prepared={page.prepared} />
}
