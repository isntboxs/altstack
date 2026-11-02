import { createFileRoute } from '@tanstack/react-router'

import { PublicError } from '#/components/public-page-state'
import { AdvertisingAdmin } from '#/features/ads/orders-admin'
import { orpc } from '#/utils/orpc'

export const Route = createFileRoute('/_main/admin/ads')({
	loader: ({ context }) =>
		context.queryClient.query(orpc.admin.ads.list.queryOptions({ input: {} })),
	errorComponent: () => <PublicError title="Unable to load campaigns" />,
	component: AdvertisingAdmin,
})
