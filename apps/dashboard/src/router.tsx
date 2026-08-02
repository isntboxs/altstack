import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'

import { getQueryClient } from '#/lib/query-client'
import { routeTree } from '#/routeTree.gen'
import { orpc } from '#/utils/orpc'

export function getRouter() {
	const queryClient = getQueryClient()

	const router = createTanStackRouter({
		routeTree,
		context: { orpc, queryClient },
		scrollRestoration: true,
		defaultPreload: 'intent',
		defaultPreloadStaleTime: 0,
	})

	setupRouterSsrQueryIntegration({ router, queryClient })

	return router
}

declare module '@tanstack/react-router' {
	interface Register {
		router: ReturnType<typeof getRouter>
	}
}
