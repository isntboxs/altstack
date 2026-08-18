import type {
	InferRouterInputs,
	InferRouterOutputs,
	RouterClient,
} from '@orpc/server'

import { o } from '@altstack/api/base'
import { altstackRouter } from '@altstack/api/routers/altstack'
import { healthRouter } from '@altstack/api/routers/health'

export const routers = o.router({
	altstack: altstackRouter,
	health: healthRouter,
})

export type ORPCRouterClient = RouterClient<typeof routers>

export type ORPCRouterInputs = InferRouterInputs<typeof routers>
export type ORPCRouterOutputs = InferRouterOutputs<typeof routers>
