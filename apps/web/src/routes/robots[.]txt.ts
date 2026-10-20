import { createFileRoute } from '@tanstack/react-router'

import { publicUrl } from '#/features/seo/meta'

export const Route = createFileRoute('/robots.txt')({
	server: {
		handlers: {
			GET: () =>
				new Response(
					[
						'User-agent: *',
						'Allow: /',
						'Allow: /og/',
						'Disallow: /api/',
						'Disallow: /auth/',
						'Disallow: /submit',
						'Disallow: /submission',
						'Disallow: /bookmarks$',
						'Disallow: /bookmarks?',
						'Disallow: /bookmarks/',
						'Disallow: /projects',
						'Disallow: /admin/',
						'',
						`Sitemap: ${publicUrl('/sitemap.xml')}`,
						'',
					].join('\n'),
					{
						headers: {
							'Content-Type': 'text/plain; charset=utf-8',
							'Cache-Control': 'public, max-age=300',
						},
					}
				),
		},
	},
})
