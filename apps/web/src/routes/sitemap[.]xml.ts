import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/sitemap.xml')({
	server: {
		handlers: {
			GET: async () => {
				const { sitemapIndex, sitemapUnavailable } =
					await import('#/features/seo/sitemap.server')
				return sitemapIndex().catch(sitemapUnavailable)
			},
		},
	},
})
