import { env } from '@altstack/env/web'

import type { CategoryNode } from '@altstack/shared/schemas/category'

export const categoriesIntro =
	'Explore open source projects by category, from everyday software to specialized developer tools.'

export function categoryHead(category?: CategoryNode) {
	const title = category
		? `Open Source ${category.name}`
		: 'Open Source Software Categories'
	const description = category
		? (category.description ??
			`Discover open source ${category.name} projects on ${env.VITE_APP_NAME}.`)
		: categoriesIntro
	const path = category ? `/categories/${category.path}` : '/categories'
	return {
		meta: [
			{ title: `${title} | ${env.VITE_APP_NAME}` },
			{ name: 'description', content: description },
		],
		links: [{ rel: 'canonical', href: new URL(path, env.VITE_APP_URL).href }],
	}
}
