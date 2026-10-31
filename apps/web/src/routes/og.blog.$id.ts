import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/og/blog/$id')({
	server: {
		handlers: {
			GET: async ({ params }) => {
				const { ogResponse } = await import('#/features/seo/og/response.server')
				return ogResponse('blog', params.id)
			},
		},
	},
})
