import type { LoggerContext } from '@orpc/evlog'
import type { Context as ElysiaContext } from 'elysia'

export async function createORPCContext(opts: ElysiaContext) {
	const [{ auth }, { db }] = await Promise.all([
		import('@altstack/auth/server'),
		import('@altstack/db'),
	])

	const session = await auth.api.getSession({ headers: opts.request.headers })

	return { db, auth: session }
}

export type ORPCContext = Awaited<ReturnType<typeof createORPCContext>> &
	LoggerContext
