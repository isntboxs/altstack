import { IconChevronDown, IconList } from '@tabler/icons-react'
import { useNavigate } from '@tanstack/react-router'
import { cn } from 'cn'
import { useEffect, useRef, useState } from 'react'

import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from '@altstack/ui/components/collapsible'

import type { ArticleHeading } from '#/features/public-content/headings'

export function BlogTableOfContents({
	headings,
}: {
	headings: Array<ArticleHeading>
}) {
	const navigate = useNavigate()
	const [open, setOpen] = useState(true)
	const [active, setActive] = useState(headings[0]?.id)
	const list = useRef<HTMLOListElement>(null)
	useEffect(() => {
		let frame = 0
		const update = () => {
			frame = 0
			let current = headings[0]?.id
			for (const heading of headings) {
				if (
					(document.getElementById(heading.id)?.getBoundingClientRect().top ??
						Infinity) <= 100
				) {
					current = heading.id
				}
			}
			// Short final sections may never reach the top of the viewport.
			const last = headings.at(-1)
			if (last) {
				const section = document.getElementById(last.id)
				const article = section?.closest('article[aria-label="Blog post"]')
				if (
					section &&
					article &&
					section.getBoundingClientRect().top < window.innerHeight &&
					article.getBoundingClientRect().bottom <= window.innerHeight
				) {
					current = last.id
				}
			}
			setActive(current)
		}
		const schedule = () => {
			if (!frame) frame = requestAnimationFrame(update)
		}
		update()
		window.addEventListener('scroll', schedule, { passive: true })
		window.addEventListener('resize', schedule)
		window.addEventListener('hashchange', schedule)
		return () => {
			cancelAnimationFrame(frame)
			window.removeEventListener('scroll', schedule)
			window.removeEventListener('resize', schedule)
			window.removeEventListener('hashchange', schedule)
		}
	}, [headings])
	useEffect(() => {
		const container = list.current
		const item = container?.querySelector<HTMLElement>(
			'[aria-current="location"]'
		)
		if (!container || !item) return
		const outer = container.getBoundingClientRect(),
			inner = item.getBoundingClientRect()
		if (inner.top < outer.top) container.scrollTop -= outer.top - inner.top
		else if (inner.bottom > outer.bottom) {
			container.scrollTop += inner.bottom - outer.bottom
		}
	}, [active, open])
	if (headings.length === 0) return null
	return (
		<aside
			className="min-w-0 lg:col-start-2 lg:row-start-1"
			aria-label="Article navigation"
		>
			<Collapsible
				open={open}
				onOpenChange={setOpen}
				className="lg:sticky lg:top-16"
			>
				<CollapsibleTrigger className="group flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-sm text-left text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
					<IconList className="size-4" aria-hidden="true" />
					On this page
					<IconChevronDown
						className="ml-auto size-4 transition-transform group-aria-expanded:rotate-180 motion-reduce:transition-none"
						aria-hidden="true"
					/>
				</CollapsibleTrigger>
				<CollapsibleContent>
					<nav aria-label="On this page">
						<ol
							ref={list}
							className="max-h-64 overflow-y-auto overscroll-contain border-l py-1 lg:max-h-[calc(100dvh-8rem)]"
						>
							{headings.map((heading) => (
								<li key={heading.id}>
									<a
										href={`#${heading.id}`}
										aria-current={
											active === heading.id ? 'location' : undefined
										}
										className={cn(
											'block min-h-11 border-l border-transparent px-3 py-2 text-sm wrap-anywhere text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring aria-[current=location]:border-foreground aria-[current=location]:text-foreground lg:min-h-0 lg:py-1.5',
											heading.depth > 2 && 'pl-6'
										)}
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
											const target = document.getElementById(heading.id)
											if (!target) return
											event.preventDefault()
											void navigate({
												hash: heading.id,
												search: true,
												resetScroll: false,
												hashScrollIntoView: false,
											})
											target.scrollIntoView({
												block: 'start',
												behavior: window.matchMedia(
													'(prefers-reduced-motion: reduce)'
												).matches
													? 'instant'
													: 'smooth',
											})
											target.focus({ preventScroll: true })
											setActive(heading.id)
										}}
									>
										{heading.title}
									</a>
								</li>
							))}
						</ol>
					</nav>
				</CollapsibleContent>
			</Collapsible>
		</aside>
	)
}
