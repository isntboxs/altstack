import { createIsomorphicFn } from '@tanstack/react-start'
import { getRequestUrl } from '@tanstack/react-start/server'

// Router searchStr is parsed/re-serialized. Use the request's original search
// for redirects so unknown keys, duplicate keys and their encoding survive.
export const categoryRedirectSearch = createIsomorphicFn()
	.server(
		(_location: { href: string; searchStr: string }) => getRequestUrl().search
	)
	.client((location: { href: string; searchStr: string }) => {
		const target = new URL(location.href, window.location.origin)
		return target.pathname === window.location.pathname
			? window.location.search
			: location.searchStr
	})
