import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import { createRouterClient } from '@orpc/server'
import { createTanstackQueryUtils } from '@orpc/tanstack-query'
import { createIsomorphicFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

import { createORPCContext } from '@altstack/api/context'
import { routers as orpcRouters } from '@altstack/api/routers'
import type { ORPCRouterClient } from '@altstack/api/routers'

const getORPCClient = createIsomorphicFn()
	.server(() => {
		const ctx = createORPCContext(getRequest())

		return createRouterClient(orpcRouters, {
			context: ctx,
		})
	})
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
