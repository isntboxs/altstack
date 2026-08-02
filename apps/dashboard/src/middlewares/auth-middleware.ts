import { createMiddleware } from '@tanstack/react-start'

import { authClient } from '@altstack/auth/client'

export const authMiddleware = createMiddleware().server(
	async ({ next, request }) => {
		const session = await authClient.getSession({
			fetchOptions: {
				headers: request.headers,
				throw: true,
			},
		})

		return next({ context: { auth: session } })
	}
)
