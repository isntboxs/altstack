import { createFileRoute, redirect } from '@tanstack/react-router'

import {
	ReportInbox,
	ReportsPending,
} from '#/features/admin-reports/components/report-inbox'

export const Route = createFileRoute('/_main/admin/reports')({
	beforeLoad: ({ context: { auth } }) => {
		if (auth.user.role !== 'admin') throw redirect({ to: '/', replace: true })
	},
	pendingMs: 250,
	pendingMinMs: 200,
	pendingComponent: ReportsPending,
	component: ReportInbox,
})
