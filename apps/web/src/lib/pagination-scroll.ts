import type { MouseEvent } from 'react'

export function createPaginationScrollHandler(targetId: string) {
	return (event: MouseEvent<HTMLAnchorElement>) => {
		if (
			event.defaultPrevented ||
			event.button !== 0 ||
			event.metaKey ||
			event.ctrlKey ||
			event.shiftKey ||
			event.altKey ||
			(event.currentTarget.target && event.currentTarget.target !== '_self') ||
			event.currentTarget.getAttribute('aria-current') === 'page'
		) {
			return
		}

		document.getElementById(targetId)?.scrollIntoView({
			block: 'start',
			behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
				? 'instant'
				: 'smooth',
		})
	}
}
