import type { ProjectStatus } from '@altstack/shared/constants'

import { Button } from '@altstack/ui/components/button'
import { Spinner } from '@altstack/ui/components/spinner'

export function ProjectReviewActions({
	status,
	pending,
	disabled,
	onAction,
}: {
	status: ProjectStatus
	pending: boolean
	disabled: boolean
	onAction: (status: 'draft' | 'published' | 'rejected') => void
}) {
	return (
		<div className="flex flex-wrap gap-2">
			<Button
				type="button"
				variant="outline"
				disabled={disabled || pending}
				onClick={() => onAction('draft')}
			>
				{pending && <Spinner />}
				{status === 'rejected'
					? 'Restore to Draft'
					: status === 'published'
						? 'Unpublish to Draft'
						: 'Save Draft'}
			</Button>
			<Button
				type="button"
				disabled={disabled || pending}
				onClick={() => onAction('published')}
			>
				{status === 'published' ? 'Save Published' : 'Publish'}
			</Button>
			<Button
				type="button"
				variant="destructive"
				disabled={disabled || pending}
				onClick={() => onAction('rejected')}
			>
				Reject
			</Button>
		</div>
	)
}
