import { IconHash } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'
import { cn } from 'cn'
import type { Element } from 'hast'
import { Children, cloneElement, isValidElement } from 'react'
import type { ComponentProps, ReactNode } from 'react'

function isContentLink(child: ReactNode) {
	return (
		isValidElement<{ node?: Element }>(child) &&
		(child.type === 'a' || child.props.node?.tagName === 'a')
	)
}

function containsLink(children: ReactNode): boolean {
	return Children.toArray(children).some(
		(child) =>
			isContentLink(child) ||
			(isValidElement<{ children?: ReactNode }>(child) &&
				containsLink(child.props.children))
	)
}

function headingTextLinks(children: ReactNode, id: string): ReactNode {
	if (!containsLink(children)) {
		if (
			Children.toArray(children).every(
				(child) => typeof child === 'string' && !child.trim()
			)
		) {
			return children
		}
		return (
			<HeadingLink
				id={id}
				className="not-prose cursor-pointer rounded-sm text-inherit no-underline underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
			>
				{children}
			</HeadingLink>
		)
	}
	return Children.map(children, (child) => {
		if (isContentLink(child)) return child
		if (
			isValidElement<{ children?: ReactNode }>(child) &&
			containsLink(child)
		) {
			return cloneElement(child, {
				children: headingTextLinks(child.props.children, id),
			})
		}
		return headingTextLinks(child, id)
	})
}

function HeadingLink({
	id,
	label,
	children,
	className,
}: {
	id: string
	label?: string
	children: ReactNode
	className: string
}) {
	return (
		<Link
			to="."
			hash={id}
			search={true}
			activeOptions={{ includeHash: true, exact: true }}
			activeProps={{ 'aria-current': 'location' }}
			resetScroll={false}
			hashScrollIntoView={false}
			preload={false}
			aria-label={label}
			title={label}
			className={className}
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
			{children}
		</Link>
	)
}

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
			{id ? headingTextLinks(children, id) : children}
			{id && (
				<HeadingLink
					id={id}
					label={`Link to ${label || id}`}
					className="not-prose absolute -top-1 right-0 inline-flex size-11 cursor-pointer items-center justify-center rounded-sm text-muted-foreground opacity-100 group-focus-within/heading:opacity-100 group-hover/heading:opacity-100 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring active:bg-muted md:[@media(hover:hover)]:opacity-0"
				>
					<IconHash className="size-4" aria-hidden="true" />
				</HeadingLink>
			)}
		</Heading>
	)
}
