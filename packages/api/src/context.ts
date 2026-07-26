import type { EvlogOrpcContext } from 'evlog/orpc'

import { auth } from '@altstack/auth'

import { db } from '@altstack/db'

export async function createORPCContext(opts: Request) {
	const session = await auth.api.getSession({ headers: opts.headers })

	return { db, auth: session }
}

export type ORPCContext = Awaited<ReturnType<typeof createORPCContext>> &
	Partial<EvlogOrpcContext>
