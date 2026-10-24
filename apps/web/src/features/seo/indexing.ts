import { createMiddleware } from '@tanstack/react-start'

export const indexingMiddleware = createMiddleware().server(
	async ({ request, next }) => {
		const result = await next()
		const path = new URL(request.url).pathname
		if (
			/^\/(?:auth|submit|submission|bookmarks|projects|managed|admin)(?:\/|$)/.test(
				path
			) ||
			result.response.status >= 400
		) {
			result.response.headers.set('X-Robots-Tag', 'noindex, follow')
		}
		// Public SSR includes auth-dependent navigation; never persist it in a CDN.
		if (result.response.headers.get('Content-Type')?.includes('text/html')) {
			result.response.headers.set('Cache-Control', 'private, no-store')
		}
		return result
	}
)
