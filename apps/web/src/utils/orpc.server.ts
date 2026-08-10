import '@tanstack/react-start/server-only'
import { createRouterClient } from '@orpc/server'
import { getRequest } from '@tanstack/react-start/server'

import { createORPCContext } from '@altstack/api/context'
import { routers as orpcRouters } from '@altstack/api/routers'

export function getORPCServerClient() {
	return createRouterClient(orpcRouters, {
		context: () => createORPCContext(getRequest()),
	})
}
