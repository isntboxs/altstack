import type { AnyRouter } from '@tanstack/react-router'
import type { MouseEvent } from 'react'

const pendingScrolls = new WeakMap<AnyRouter, () => void>()

/** Waits for the clicked destination to render, after the outgoing scroll snapshot. */
export function createPaginationScrollHandler(
	targetId: string,
	router: AnyRouter
) {
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

		const destination = new URL(event.currentTarget.href)
		const href = `${destination.pathname}${destination.search}${destination.hash}`
		pendingScrolls.get(router)?.()
		// Keep this subscription through pending-boundary unmounts; a later click replaces it.
		const unsubscribe = router.subscribe('onRendered', ({ toLocation }) => {
			unsubscribe()
			pendingScrolls.delete(router)
			if (toLocation.publicHref !== href) return

			document.getElementById(targetId)?.scrollIntoView({
				block: 'start',
				behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
					? 'instant'
					: 'smooth',
			})
		})
		pendingScrolls.set(router, unsubscribe)
	}
}
