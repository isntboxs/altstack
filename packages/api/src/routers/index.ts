import type {
	InferRouterInputs,
	InferRouterOutputs,
	RouterClient,
} from '@orpc/server'

import { o } from '@altstack/api/base'
import { altstackRouter } from '@altstack/api/routers/altstack'
import { healthRouter } from '@altstack/api/routers/health'
import { projectRouter } from '@altstack/api/routers/project'
import { submissionRouter } from '@altstack/api/routers/submission'

export const routers = o.router({
	altstack: altstackRouter,
	health: healthRouter,
	project: projectRouter,
	submission: submissionRouter,
})

export type ORPCRouterClient = RouterClient<typeof routers>

export type ORPCRouterInputs = InferRouterInputs<typeof routers>
export type ORPCRouterOutputs = InferRouterOutputs<typeof routers>
