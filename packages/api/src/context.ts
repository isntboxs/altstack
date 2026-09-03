import type { LoggerContext } from '@orpc/evlog'

export async function createORPCContext({ headers }: { headers: Headers }) {
	const [{ auth }, { db }] = await Promise.all([
		import('@altstack/auth/server'),
		import('@altstack/db'),
	])

	const session = await auth.api.getSession({ headers })

	return { db, auth: session }
}

export type ORPCContext = Awaited<ReturnType<typeof createORPCContext>> &
	LoggerContext
