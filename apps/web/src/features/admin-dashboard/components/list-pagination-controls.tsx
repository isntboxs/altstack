import { IconArrowLeft, IconArrowRight } from '@tabler/icons-react'

import { Button } from '@altstack/ui/components/button'

export function ListPaginationControls({
	page,
	pageCount,
	fetching,
	onPageChange,
}: {
	page: number
	pageCount: number
	fetching: boolean
	onPageChange: (page: number) => void
}) {
	return (
		<div className="flex items-center gap-3">
			<Button
				variant="outline"
				size="sm"
				disabled={page === 1 || fetching}
				onClick={() => onPageChange(page - 1)}
			>
				<IconArrowLeft data-icon="inline-start" />
				Previous
			</Button>
			<span className="text-xs text-muted-foreground">
				{page} / {pageCount}
			</span>
			<Button
				variant="outline"
				size="sm"
				disabled={page >= pageCount || fetching}
				onClick={() => onPageChange(page + 1)}
			>
				Next
				<IconArrowRight data-icon="inline-end" />
			</Button>
		</div>
	)
}
