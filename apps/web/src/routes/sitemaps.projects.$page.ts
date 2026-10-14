import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/sitemaps/projects/$page')({
	server: {
		handlers: {
			GET: async ({ params }) => {
				const { sitemapProjectPage, sitemapUnavailable } =
					await import('#/features/seo/sitemap.server')
				return sitemapProjectPage(params.page).catch(sitemapUnavailable)
			},
		},
	},
})
