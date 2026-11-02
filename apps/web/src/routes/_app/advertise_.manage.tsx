import { createFileRoute } from '@tanstack/react-router'

import { AdOrderManage } from '#/features/ads/order-manage'
import { seoHead } from '#/features/seo/meta'

export const Route = createFileRoute('/_app/advertise_/manage')({
	head: () => {
		const head = seoHead({
			title: 'Manage advertising order | AltStack',
			description: 'Private advertising order management.',
			noindex: true,
		})
		return {
			...head,
			meta: [...head.meta, { name: 'referrer', content: 'no-referrer' }],
		}
	},
	component: AdOrderManage,
})
