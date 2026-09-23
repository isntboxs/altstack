import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import { createRouterClient } from '@orpc/server'
import { createTanstackQueryUtils } from '@orpc/tanstack-query'
import { createIsomorphicFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'

import { createORPCContext } from '@altstack/api/context'
import { routers } from '@altstack/api/routers'
import type { ORPCRouterClient } from '@altstack/api/routers'

import { env } from '@altstack/env/web'

type ClientContext = {
	cache?: RequestCache
}

const getORPCClient = createIsomorphicFn()
	.server(() =>
		createRouterClient(routers, {
			context: async () => createORPCContext({ headers: getRequestHeaders() }),
		})
	)
	.client((): ORPCRouterClient => {
		const link = new RPCLink<ClientContext>({
			origin: `${env.VITE_SERVER_URL}`,
			url: `/api/rpc`,
			method: ({ context }, path) => {
				if (context.cache) {
					return 'GET'
				}

				if (path.at(-1)?.match(/^(?:get|find|list|search)(?:[A-Z].*)?$/)) {
					return 'GET'
				}

				return 'POST'
			},
			fetch(url, options, { context }) {
				return fetch(url, {
					...options,
					credentials: 'include',
					cache: context.cache,
				})
			},
		})

		return createORPCClient(link)
	})

const client: ORPCRouterClient = getORPCClient()

export const orpc = createTanstackQueryUtils(client)
export const projectORPC = createTanstackQueryUtils(client.project, {
	prefix: 'project',
})

export const adminORPC = {
	project: createTanstackQueryUtils(client.admin.project, {
		prefix: 'admin/project',
	}),
}
