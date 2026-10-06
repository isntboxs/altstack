import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

import {
	CategoryLoading,
	CategoryNotFound,
	CategoryRouteError,
} from '#/features/admin-categories/components/category-route-state'

export const Route = createFileRoute('/_main/admin/categories')({
	beforeLoad: ({ context: { auth } }) => {
		if (auth.user.role !== 'admin') throw redirect({ to: '/', replace: true })
	},
	component: Outlet,
	pendingComponent: CategoryLoading,
	notFoundComponent: CategoryNotFound,
	errorComponent: CategoryRouteError,
})
