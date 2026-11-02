import { useHydrated } from '@tanstack/react-router'

import { catalogueOffset, DISPLAY_SLOTS } from './selection'

export function useCatalogueOffset(catalogue: string, page: number) {
	const hydrated = useHydrated()
	return hydrated
		? catalogueOffset(catalogue, page)
		: Math.max(0, page - 1) * DISPLAY_SLOTS
}
