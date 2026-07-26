import { evlog } from 'evlog/orpc'

import { o } from '@altstack/api/base'

const authMiddleware = o.middleware(async ({ context, next, errors }) => {
	const { auth } = context

	if (!auth) throw errors.UNAUTHORIZED()

	return next({ context: { auth } })
})

export const publicProcedure = o.use(evlog())
export const protectedProcedure = o.use(evlog()).use(authMiddleware)
