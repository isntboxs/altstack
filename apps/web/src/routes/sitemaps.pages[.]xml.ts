import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/sitemaps/pages.xml')({
	server: {
		handlers: {
			GET: async () => {
				const { sitemapPages, sitemapUnavailable } =
					await import('#/features/seo/sitemap.server')
				return sitemapPages().catch(sitemapUnavailable)
			},
		},
	},
})
