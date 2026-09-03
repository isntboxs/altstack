import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import { createTanstackQueryUtils } from '@orpc/tanstack-query'

import type { ORPCRouterClient } from '@altstack/api/routers'

import { env } from '@altstack/env/web'

type ClientContext = {
	cache?: RequestCache
}

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

const getORPCClient = (): ORPCRouterClient => createORPCClient(link)

const client: ORPCRouterClient = getORPCClient()

export const orpc = createTanstackQueryUtils(client)
export const projectORPC = createTanstackQueryUtils(client.project, {
	prefix: 'project',
})
