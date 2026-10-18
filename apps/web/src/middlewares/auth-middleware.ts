import { createMiddleware } from '@tanstack/react-start'
import { getResponseHeaders } from '@tanstack/react-start/server'

import { authClient } from '@altstack/auth/client'

export const authMiddleware = createMiddleware().server(
	async ({ next, request }) => {
		const session = await authClient.getSession({
			fetchOptions: {
				// Forward credentials, without copying the web host or transport headers.
				headers: { cookie: request.headers.get('cookie') ?? '' },
				throw: true,
				onResponse: ({ response }) => {
					// Session refreshes and expirations must reach the browser during SSR.
					for (const cookie of response.headers.getSetCookie()) {
						getResponseHeaders().append('set-cookie', cookie)
					}
				},
			},
		})

		return next({ context: { auth: session } })
	}
)
