import { useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'

export function HistoryScrollRestoration() {
	const router = useRouter()

	useEffect(() => {
		const originalBehavior = router.options.scrollRestorationBehavior
		let restoreFromTop = false
		const unsubscribeHistory = router.history.subscribe(({ action }) => {
			restoreFromTop =
				action.type === 'BACK' ||
				action.type === 'FORWARD' ||
				action.type === 'GO'
			router.update({
				context: router.options.context,
				scrollRestorationBehavior:
					restoreFromTop &&
					!window.matchMedia('(prefers-reduced-motion: reduce)').matches
						? 'smooth'
						: 'instant',
			})
		})
		const unsubscribeMount = router.subscribe('onBeforeRouteMount', () => {
			if (!restoreFromTop) return
			restoreFromTop = false
			// The outgoing position has been saved; reset before the destination paints.
			window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
		})

		return () => {
			unsubscribeHistory()
			unsubscribeMount()
			router.update({
				context: router.options.context,
				scrollRestorationBehavior: originalBehavior,
			})
		}
	}, [router, router.history])

	return null
}
