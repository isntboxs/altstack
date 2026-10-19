import { IconExternalLink } from '@tabler/icons-react'
import { Link, useRouter } from '@tanstack/react-router'
import type { Element, ElementContent } from 'hast'
import type { ReactNode } from 'react'

import { env } from '@altstack/env/web'

import { Badge } from '@altstack/ui/components/badge'

import { ProjectHoverCard } from '#/components/project-hover-card'
import { ProjectLogo } from '#/components/project-media'
import { contentLink } from '#/features/public-content/model'
import type { ProjectMention } from '#/features/public-content/model'

function containsImage(node: Element | ElementContent): boolean {
	return (
		node.type === 'element' &&
		(node.tagName === 'img' || node.children.some(containsImage))
	)
}

export function ContentLink({
	href,
	title,
	children,
	node,
	slug,
	projects,
}: {
	href?: string
	title?: string
	children?: ReactNode
	node?: Element
	slug: string
	projects: Record<string, ProjectMention>
}) {
	const target = href && contentLink(href, slug, env.VITE_APP_URL)
	if (!target) {
		return (
			<a href={href} title={title} rel="noopener noreferrer">
				{children}
			</a>
		)
	}
	if (!target.internal) {
		return (
			<a href={href} title={title} target="_blank" rel="noopener noreferrer">
				{children}
				<IconExternalLink
					className="ml-0.5 inline size-3.5 align-baseline"
					aria-hidden="true"
				/>
				<span className="sr-only"> (opens in a new tab)</span>
			</a>
		)
	}
	const project =
		target.projectSlug && Object.hasOwn(projects, target.projectSlug)
			? projects[target.projectSlug]
			: undefined
	return (
		<InternalContentLink
			url={target.url}
			title={title}
			project={node && containsImage(node) ? undefined : project}
		>
			{children}
		</InternalContentLink>
	)
}

function InternalContentLink({
	url,
	title,
	project,
	children,
}: {
	url: URL
	title?: string
	project?: ProjectMention
	children: ReactNode
}) {
	const router = useRouter()
	const search = router.options.parseSearch(url.search)
	const hash = url.hash.slice(1)
	if (project) {
		return (
			<ProjectHoverCard project={project}>
				<Badge
					variant="secondary"
					className="not-prose h-auto max-w-full gap-1.5 px-2 py-1 align-middle"
					render={
						<Link
							to="/$slug"
							params={{ slug: project.slug }}
							search={search}
							hash={hash}
							title={title}
						/>
					}
					data-project-mention={project.slug}
				>
					<ProjectLogo
						src={project.logo}
						name={project.name}
						className="size-4"
					/>
					<span className="truncate">{project.name}</span>
				</Badge>
			</ProjectHoverCard>
		)
	}
	// Markdown targets are runtime paths, so the router resolves their route.
	return (
		<Link to={url.pathname} search={search} hash={hash} title={title}>
			{children}
		</Link>
	)
}
