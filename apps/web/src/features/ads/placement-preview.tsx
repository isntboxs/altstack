import { IconArrowUpRight } from '@tabler/icons-react'

function MiniAdCard({ compact = false }: { compact?: boolean }) {
	return (
		<div className="relative w-44 rounded-md border bg-background p-3 shadow-xs">
			<span className="absolute -top-2 left-3 rounded-xs border bg-background px-1 text-[9px] text-muted-foreground">
				Ad
			</span>
			<div className="flex items-center gap-2">
				<span className="size-3 shrink-0 rounded-xs bg-primary/70" />
				<span className="text-[11px] font-medium">Your brand</span>
			</div>
			<p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
				A short introduction to your product.
			</p>
			{!compact && (
				<div className="mt-3 flex items-center justify-between rounded-xs bg-primary px-2 py-1.5 text-[10px] text-primary-foreground">
					<span>View website</span>
					<IconArrowUpRight className="size-3" />
				</div>
			)}
		</div>
	)
}

export function PlacementPreview({
	kind,
}: {
	kind: 'cards' | 'corner' | 'banner' | 'sponsors'
}) {
	return (
		<div
			aria-hidden="true"
			className="relative flex aspect-[5/3] items-center justify-center overflow-hidden rounded-lg border bg-muted/40 p-5"
			data-placement-preview={kind}
		>
			{kind === 'cards' && <MiniAdCard />}
			{kind === 'corner' && (
				<>
					<div className="absolute inset-x-6 top-7 flex flex-col gap-2.5">
						<div className="h-1.5 w-2/5 rounded-full bg-foreground/10" />
						<div className="h-1.5 w-4/5 rounded-full bg-foreground/10" />
						<div className="h-1.5 w-3/5 rounded-full bg-foreground/10" />
					</div>
					<div className="absolute right-5 bottom-5">
						<MiniAdCard compact />
					</div>
				</>
			)}
			{kind === 'banner' && (
				<div className="flex w-full flex-col gap-4">
					<div className="flex items-center gap-2 rounded-md border bg-background px-3 py-3 text-[10px]">
						<span className="rounded-xs border px-1 text-[9px] text-muted-foreground">
							Ad
						</span>
						<span className="size-2.5 shrink-0 rounded-xs bg-primary/70" />
						<span className="font-medium">Your brand</span>
						<span className="truncate text-muted-foreground">
							· Your one-line introduction
						</span>
					</div>
					<div className="flex flex-col gap-2">
						<div className="h-1.5 w-3/4 rounded-full bg-foreground/10" />
						<div className="h-1.5 w-1/2 rounded-full bg-foreground/10" />
					</div>
				</div>
			)}
			{kind === 'sponsors' && (
				<div className="grid w-full grid-cols-3 overflow-hidden rounded-md border bg-background">
					{Array.from({ length: 6 }, (_, i) => (
						<div
							key={i}
							className="flex h-14 items-center justify-center border-r border-b nth-[3n]:border-r-0 nth-[n+4]:border-b-0"
						>
							{i === 1 ? (
								<span className="px-1 text-center text-[11px] font-semibold">
									Your brand
								</span>
							) : (
								<span className="h-1.5 w-2/5 rounded-full bg-foreground/10" />
							)}
						</div>
					))}
				</div>
			)}
		</div>
	)
}
