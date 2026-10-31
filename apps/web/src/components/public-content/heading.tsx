import { IconHash } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'
import { cn } from 'cn'
import type { ComponentProps } from 'react'

export function ContentHeading({
	as: Heading,
	label,
	children,
	id,
	className,
	...props
}: ComponentProps<'h2'> & {
	as: 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
	label: string
}) {
	return (
		<Heading
			{...props}
			id={id}
			className={cn(className, id && 'group/heading relative pr-11')}
		>
			{children}
			{id && (
				<Link
					to="."
					hash={id}
					search={true}
					activeOptions={{ includeHash: true, exact: true }}
					activeProps={{ 'aria-current': 'location' }}
					resetScroll={false}
					hashScrollIntoView={false}
					preload={false}
					aria-label={`Link to ${label || id}`}
					title={`Link to ${label || id}`}
					className="not-prose absolute -top-1 right-0 inline-flex size-11 cursor-pointer items-center justify-center rounded-sm text-muted-foreground opacity-100 group-focus-within/heading:opacity-100 group-hover/heading:opacity-100 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring active:bg-muted md:[@media(hover:hover)]:opacity-0"
					onClick={(event) => {
						if (
							event.button !== 0 ||
							event.metaKey ||
							event.ctrlKey ||
							event.shiftKey ||
							event.altKey
						) {
							return
						}
						const target = document.getElementById(id)
						target?.scrollIntoView({
							block: 'start',
							behavior: window.matchMedia('(prefers-reduced-motion: reduce)')
								.matches
								? 'instant'
								: 'smooth',
						})
						target?.focus({ preventScroll: true })
					}}
				>
					<IconHash className="size-4" aria-hidden="true" />
				</Link>
			)}
		</Heading>
	)
}
