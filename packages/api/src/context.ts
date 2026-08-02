import type { Context as ElysiaContext } from 'elysia'
import type { EvlogOrpcContext } from 'evlog/orpc'

import type { auth } from '@altstack/auth/server'

import type { db } from '@altstack/db'

export type ORPCContext = {
	db: typeof db
	auth: Awaited<ReturnType<typeof auth.api.getSession>>
} & EvlogOrpcContext

export async function createORPCContext(
	opts: ElysiaContext
): Promise<ORPCContext> {
	const [{ auth }, { db }] = await Promise.all([
		import('@altstack/auth/server'),
		import('@altstack/db'),
	])

	const session = await auth.api.getSession({ headers: opts.request.headers })

	return { db, auth: session } as ORPCContext
}
