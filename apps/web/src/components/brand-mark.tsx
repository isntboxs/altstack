import { cn } from 'cn'

export const BrandMark = ({ className }: { className?: string }) => (
	<svg
		viewBox="0 0 256 256"
		fill="currentColor"
		className={cn('size-5 shrink-0', className)}
		aria-hidden="true"
		focusable="false"
	>
		<path d="M16 16H160V80H128L64 144V176H16Z" />
		<path d="M240 240H96V176H128L192 112V80H240Z" />
	</svg>
)
