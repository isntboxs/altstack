import { db } from '@altstack/db'

export function createORPCContext(_opts: Request) {
	return { db }
}

export type ORPCContext = Awaited<ReturnType<typeof createORPCContext>>
