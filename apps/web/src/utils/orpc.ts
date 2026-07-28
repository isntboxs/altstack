import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import { createTanstackQueryUtils } from '@orpc/tanstack-query'

import type { ORPCRouterClient } from '@altstack/api/routers'

import { env } from '@altstack/env/web'

const link = new RPCLink({
	url: `${env.VITE_APP_URL}/api/rpc`,
	fetch(url, options) {
		return fetch(url, {
			...options,
			credentials: 'include',
		})
	},
})

const getORPCClient = (): ORPCRouterClient => createORPCClient(link)

const client: ORPCRouterClient = getORPCClient()

export const orpc = createTanstackQueryUtils(client)
