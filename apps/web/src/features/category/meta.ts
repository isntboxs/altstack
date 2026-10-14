import { env } from '@altstack/env/web'

import type { CategoryNode } from '@altstack/shared/schemas/category'

import {
	cataloguePolicy,
	categoryImage,
	publicUrl,
	seoHead,
} from '#/features/seo/meta'

export const categoriesIntro =
	'Explore open source projects by category, from everyday software to specialized developer tools.'

export function categoryHead(
	category?: CategoryNode,
	search: { q?: string; sort?: string; page?: number } = {},
	totalPages = Infinity
) {
	const title = category
		? `Open Source ${category.name}`
		: 'Open Source Software Categories'
	const description = category
		? (category.description ??
			`Discover open source ${category.name} projects on ${env.VITE_APP_NAME}.`)
		: categoriesIntro
	const policy = cataloguePolicy(
		category ? `/categories/${category.path}` : '/categories',
		search,
		totalPages
	)
	return seoHead({
		title: `${title}${policy.pageSuffix} | ${env.VITE_APP_NAME}`,
		description,
		...policy,
		noindex: policy.noindex || category?.projectCount === 0,
		...(category
			? {
					image: categoryImage(
						category.id,
						category.name,
						category.description
					),
					imageAlt: `Open Source ${category.name} — AltStack`,
				}
			: {}),
		entities: [
			{
				'@type': 'CollectionPage',
				name: title,
				description,
				url: publicUrl(policy.path),
				isPartOf: { '@id': publicUrl('/#website') },
			},
		],
	})
}
