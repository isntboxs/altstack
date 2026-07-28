import type { EvlogOrpcContext } from 'evlog/orpc'

import type { auth } from '@altstack/auth/server'

import type { db } from '@altstack/db'

export type ORPCContext = {
	db: typeof db
	auth: Awaited<ReturnType<typeof auth.api.getSession>>
} & EvlogOrpcContext

export async function createORPCContext(opts: Request): Promise<ORPCContext> {
	const [{ auth }, { db }] = await Promise.all([
		import('@altstack/auth/server'),
		import('@altstack/db'),
	])

	const session = await auth.api.getSession({ headers: opts.headers })

	return { db, auth: session } as ORPCContext
}
