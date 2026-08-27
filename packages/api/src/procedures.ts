import { o } from '@altstack/api/base'

const authMiddleware = o.middleware(async ({ context, next, errors }) => {
	const { auth } = context

	if (!auth) throw errors.UNAUTHORIZED()

	return next({ context: { auth } })
})

const adminMiddleware = o.middleware(async ({ context, next, errors }) => {
	const { auth } = context

	if (!auth) throw errors.UNAUTHORIZED()

	if (auth.user.role !== 'admin') throw errors.FORBIDDEN()

	return next({ context: { auth } })
})

export const publicProcedure = o
export const protectedProcedure = o.use(authMiddleware)
export const adminProcedure = o.use(adminMiddleware)
