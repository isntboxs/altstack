import type { ResponseHeadersPluginContext } from '@orpc/server/plugins'
import type { Context as ElysiaContext } from 'elysia'
import type { EvlogOrpcContext } from 'evlog/orpc'

export interface CreateORPCContext {
	context: ElysiaContext
}

export const createORPCContext = (opts: CreateORPCContext) => {
	return {
		...opts,
	}
}

export type ORPCContext = Awaited<ReturnType<typeof createORPCContext>> &
	EvlogOrpcContext &
	ResponseHeadersPluginContext
