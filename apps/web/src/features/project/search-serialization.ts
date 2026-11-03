import { defaultStringifySearch } from '@tanstack/react-router'

export function stringifyProjectSearch(search: Record<string, unknown>) {
	return defaultStringifySearch(search).replace(
		/([?&](?:category|license)=)([^&]*)/g,
		(_match, key: string, value: string) => key + value.replace(/%2C/gi, ',')
	)
}
