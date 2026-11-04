import { useEffect, useState } from 'react'
import type { RefObject } from 'react'

/** Observes only hidden ad elements. No network bait or replacement ad request. */
export function useHiddenAds(
	ref: RefObject<HTMLDivElement | null>,
	ids: string
) {
	const [hidden, setHidden] = useState<Array<string>>([])
	useEffect(() => {
		const root = ref.current
		if (!root) return
		const check = () => {
			const next = Array.from(
				root.querySelectorAll<HTMLElement>('[data-ad-id]')
			)
				.filter((element) => {
					const style = getComputedStyle(element)
					const child = element.firstElementChild
					return (
						element.getClientRects().length === 0 ||
						style.display === 'none' ||
						style.visibility === 'hidden' ||
						style.opacity === '0' ||
						(child instanceof HTMLElement &&
							(getComputedStyle(child).display === 'none' ||
								getComputedStyle(child).visibility === 'hidden'))
					)
				})
				.map((element) => element.dataset.adId!)
			setHidden((old) => {
				const merged = new Set(old)
				for (const id of next) merged.add(id)
				return merged.size === old.length ? old : [...merged]
			})
		}
		const timer = window.setInterval(check, 1000)
		const observer = new MutationObserver(check)
		observer.observe(root, {
			attributes: true,
			subtree: true,
			attributeFilter: ['class', 'style', 'hidden'],
		})
		check()
		return () => {
			clearInterval(timer)
			observer.disconnect()
		}
	}, [ref, ids])
	return hidden
}
