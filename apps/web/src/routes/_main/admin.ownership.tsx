import { createFileRoute, Link } from '@tanstack/react-router'

import { buttonVariants } from '@altstack/ui/components/button'

import { AdminPageHeader } from '#/features/admin-dashboard/components/dashboard-state'
import { adminOwnershipSearchSchema } from '#/features/admin-dashboard/search'
import { ClaimInbox } from '#/features/project/components/claim-inbox'

export const Route = createFileRoute('/_main/admin/ownership')({
	validateSearch: adminOwnershipSearchSchema,
	component: Ownership,
})
function Ownership() {
	const search = Route.useSearch()
	const navigate = Route.useNavigate()
	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-8">
			<AdminPageHeader
				title="Ownership requests"
				description="Verify project representatives and review eligible requests with supporting evidence."
			>
				{search.claimId && (
					<Link
						to="/admin/ownership"
						search={{}}
						className={buttonVariants({ variant: 'outline' })}
					>
						All requests
					</Link>
				)}
			</AdminPageHeader>
			<ClaimInbox
				page={search.page ?? 1}
				claimId={search.claimId}
				onPageChange={(page) => void navigate({ search: { ...search, page } })}
			/>
		</div>
	)
}
