import { IconArrowLeft, IconArrowRight } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'

import { Button, buttonVariants } from '@altstack/ui/components/button'

/** Shows bounded page links, leaving first-page URL cleanup to route middleware. */
export function CollectionPagination({
	page,
	totalPages,
}: {
	page: number
	totalPages: number
}) {
	if (totalPages <= 1) return null
	const pages = [...new Set([1, page - 1, page, page + 1, totalPages])].filter(
		(value) => value > 0 && value <= totalPages
	)
	return (
		<nav
			aria-label="Collections pagination"
			className="flex flex-wrap items-center justify-between gap-3 border-t pt-5"
		>
			{page > 1 ? (
				<Link
					className={buttonVariants({ variant: 'ghost' })}
					to="/collections"
					activeOptions={{ exact: true, explicitUndefined: true }}
					search={{ page: page - 1 }}
					resetScroll={false}
				>
					<IconArrowLeft data-icon="inline-start" />
					Prev
				</Link>
			) : (
				<Button variant="ghost" disabled>
					<IconArrowLeft data-icon="inline-start" />
					Prev
				</Button>
			)}
			<div className="flex flex-wrap items-center gap-1">
				<span className="mr-1 text-sm text-muted-foreground">Page:</span>
				{pages.map((value, index) => (
					<span key={value} className="flex items-center gap-1">
						{index > 0 && value > (pages[index - 1] ?? 0) + 1 && (
							<span aria-hidden="true">…</span>
						)}
						<Link
							className={buttonVariants({
								variant: value === page ? 'secondary' : 'ghost',
								size: 'sm',
							})}
							to="/collections"
							activeOptions={{ exact: true, explicitUndefined: true }}
							search={{ page: value }}
							resetScroll={false}
							aria-current={value === page ? 'page' : undefined}
						>
							{value}
						</Link>
					</span>
				))}
			</div>
			{page < totalPages ? (
				<Link
					className={buttonVariants({ variant: 'ghost' })}
					to="/collections"
					activeOptions={{ exact: true, explicitUndefined: true }}
					search={{ page: page + 1 }}
					resetScroll={false}
				>
					Next
					<IconArrowRight data-icon="inline-end" />
				</Link>
			) : (
				<Button variant="ghost" disabled>
					Next
					<IconArrowRight data-icon="inline-end" />
				</Button>
			)}
		</nav>
	)
}
