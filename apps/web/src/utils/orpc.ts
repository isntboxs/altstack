import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import { createTanstackQueryUtils } from '@orpc/tanstack-query'
import { createIsomorphicFn } from '@tanstack/react-start'

import type { ORPCRouterClient } from '@altstack/api/routers'

import { getORPCServerClient } from '#/utils/orpc.server'

const getORPCClient = createIsomorphicFn()
	.server(() => getORPCServerClient())
	.client((): ORPCRouterClient => {
		const link = new RPCLink({
			url: `${window.location.origin}/api/rpc`,
			fetch(url, options) {
				return fetch(url, {
					...options,
					credentials: 'include',
				})
			},
		})

		return createORPCClient(link)
	})

const client: ORPCRouterClient = getORPCClient()

export const orpc = createTanstackQueryUtils(client)
