import { createMiddleware } from '@tanstack/react-start'

import { isCategoryPath } from './path'

// Start canonicalizes the URL before loaders run (including duplicate slashes).
// Reject malformed category addresses before that step instead of redirecting
// them to an unrelated, valid hierarchy address. Valid pages use the route UI.
export const categoryRequestMiddleware = createMiddleware().server(
	({ request, next }) => {
		const pathname = new URL(request.url).pathname
		if (isCategoryPath(pathname.slice('/categories/'.length))) return next()
		return new Response(
			'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Category not found</title></head><body><main><h1>Category not found</h1><p>This category address does not exist.</p><a href="/categories">Browse categories</a></main></body></html>',
			{ status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
		)
	}
)
