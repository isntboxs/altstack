import { IconRefresh } from '@tabler/icons-react'

import { Button } from '@altstack/ui/components/button'

import { useAdminProjectGithubRefresh } from '#/features/admin-projects/queries'

export function GithubStatisticsRefresh({
	projectId,
	repositoryUrl,
	disabled = false,
}: {
	projectId: string
	repositoryUrl: string
	disabled?: boolean
}) {
	const refresh = useAdminProjectGithubRefresh()
	return (
		<div className="space-y-2">
			<Button
				type="button"
				variant="outline"
				size="sm"
				disabled={disabled || refresh.isPending}
				onClick={() => refresh.mutate({ params: { id: projectId } })}
			>
				<IconRefresh
					className={refresh.isPending ? 'animate-spin' : undefined}
				/>
				{refresh.isPending
					? 'Refreshing GitHub stats…'
					: 'Refresh GitHub stats'}
			</Button>
			<p className="text-xs text-muted-foreground">
				Refreshes the saved repository: {repositoryUrl}
			</p>
		</div>
	)
}
