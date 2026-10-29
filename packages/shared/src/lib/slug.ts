import limax from 'limax'

import { RESERVED_PROJECT_SLUGS } from '@altstack/shared/constants'

/** Checks whether a normalized project slug would shadow a site route. */
export function isReservedProjectSlug(slug: string) {
	return RESERVED_PROJECT_SLUGS.has(slug)
}

export function slugify(value: string): string {
	return limax(value)
}
