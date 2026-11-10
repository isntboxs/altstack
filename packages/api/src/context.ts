import type { LoggerContext } from '@orpc/evlog'

import { auth } from '@altstack/auth/server'

export async function createORPCContext({ headers }: { headers: Headers }) {
	const { db } = await import('@altstack/db')

	const session = await auth.api.getSession({ headers })

	return { db, auth: session, requestHeaders: headers }
}

export type ORPCContext = Omit<
	Awaited<ReturnType<typeof createORPCContext>>,
	'requestHeaders'
> & { requestHeaders?: Headers } & LoggerContext
