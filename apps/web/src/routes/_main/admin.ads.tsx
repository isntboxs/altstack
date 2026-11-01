import { createFileRoute } from '@tanstack/react-router'

import { PublicError } from '#/components/public-page-state'
import { AdsAdmin } from '#/features/ads/admin-editor'
import { orpc } from '#/utils/orpc'

export const Route = createFileRoute('/_main/admin/ads')({
	loader: ({ context }) =>
		context.queryClient.query(orpc.admin.ads.list.queryOptions({ input: {} })),
	errorComponent: () => <PublicError title="Unable to load campaigns" />,
	component: AdsAdmin,
})
