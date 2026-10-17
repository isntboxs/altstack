import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$slug/badge.svg')({
	server: {
		handlers: {
			GET: async ({ request, params }) => {
				const { badgeResponse } =
					await import('#/features/project/embed/response.server')
				return badgeResponse(request, params.slug)
			},
			HEAD: async ({ request, params }) => {
				const { badgeResponse } =
					await import('#/features/project/embed/response.server')
				return badgeResponse(request, params.slug)
			},
		},
	},
})
