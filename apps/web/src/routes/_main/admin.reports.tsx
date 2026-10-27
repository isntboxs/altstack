import { createFileRoute, redirect } from '@tanstack/react-router'

import { adminReportSearchSchema } from '#/features/admin-dashboard/search'
import {
	ReportInbox,
	ReportsPending,
} from '#/features/admin-reports/components/report-inbox'

export const Route = createFileRoute('/_main/admin/reports')({
	validateSearch: adminReportSearchSchema,
	beforeLoad: ({ context: { auth } }) => {
		if (auth.user.role !== 'admin') throw redirect({ to: '/', replace: true })
	},
	pendingMs: 250,
	pendingMinMs: 200,
	pendingComponent: ReportsPending,
	component: Reports,
})

function Reports() {
	const search = Route.useSearch()
	const navigate = Route.useNavigate()
	return (
		<ReportInbox
			search={search}
			onSearchChange={(next) => void navigate({ search: next })}
		/>
	)
}
