import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/og/project/$id')({
	server: {
		handlers: {
			GET: async ({ params }) => {
				const { ogResponse } = await import('#/features/seo/og/response.server')
				return ogResponse('project', params.id)
			},
		},
	},
})
