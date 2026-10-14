import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/og/category/$id')({
	server: {
		handlers: {
			GET: async ({ params }) => {
				const { ogResponse } = await import('#/features/seo/og/response.server')
				return ogResponse('category', params.id)
			},
		},
	},
})
