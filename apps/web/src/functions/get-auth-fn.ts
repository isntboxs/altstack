import { createServerFn } from '@tanstack/react-start'

import { authMiddleware } from '#/middlewares/auth-middleware.ts'

export const getAuthFn = createServerFn({ method: 'GET' })
	.middleware([authMiddleware])
	.handler(({ context }) => context.auth)
