import { createFileRoute, redirect } from '@tanstack/react-router'

import { PublicError } from '#/components/public-page-state'
import {
	FeaturedEditor,
	FeaturedPending,
} from '#/features/admin-featured/components/featured-editor'
import { adminFeaturedQueries } from '#/features/admin-featured/queries'

export const Route = createFileRoute('/_main/admin/featured')({
	beforeLoad: ({ context: { auth } }) => {
		if (auth.user.role !== 'admin') throw redirect({ to: '/', replace: true })
	},
	loader: ({ context }) =>
		context.queryClient.query(adminFeaturedQueries.list()),
	pendingMs: 250,
	pendingMinMs: 200,
	pendingComponent: FeaturedPending,
	errorComponent: () => (
		<PublicError title="Unable to load featured projects" />
	),
	component: FeaturedEditor,
})
