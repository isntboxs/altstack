import { createFileRoute } from '@tanstack/react-router'

import { AdvertisePage } from '#/features/ads/advertise-page'
import { seoHead } from '#/features/seo/meta'

export const Route = createFileRoute('/_app/advertise')({
	head: () =>
		seoHead({
			title: 'Advertise on AltStack',
			description:
				'Monthly advertising packages from US$15. Pay through Ko-fi with manual confirmation, no AltStack account, and no automatic renewal.',
			path: '/advertise',
		}),
	component: AdvertisePage,
})
