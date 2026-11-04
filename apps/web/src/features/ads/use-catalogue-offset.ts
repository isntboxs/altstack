import { useSyncExternalStore } from 'react'

import { catalogueOffset, DISPLAY_SLOTS } from './selection'

const subscribe = () => () => undefined

export function useCatalogueOffset(catalogue: string, page: number) {
	return useSyncExternalStore(
		subscribe,
		() => catalogueOffset(catalogue, page),
		() => Math.max(0, page - 1) * DISPLAY_SLOTS
	)
}
