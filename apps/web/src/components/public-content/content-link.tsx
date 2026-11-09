import { IconExternalLink, IconFolders } from '@tabler/icons-react'
import { Link, useRouter } from '@tanstack/react-router'
import type { Element, ElementContent } from 'hast'
import { useState } from 'react'
import type { ReactNode } from 'react'

import { env } from '@altstack/env/web'

import type { CollectionMention } from '@altstack/shared/schemas/collection'

import { Badge } from '@altstack/ui/components/badge'

import { CollectionHoverCard } from '#/components/collection-hover-card'
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
	collections,
}: {
	href?: string
	title?: string
	children?: ReactNode
	node?: Element
	slug: string
	projects: Record<string, ProjectMention>
	collections: Record<string, CollectionMention>
}) {
	const target = href && contentLink(href, slug, env.VITE_APP_URL)
	if (!target) {
		return (
			<a href={href} title={title} rel="noopener noreferrer">
				{children}
			</a>
		)
	}
	const imageLink = node && containsImage(node)
	const faviconSrc = target.internal
		? '/favicon.svg'
		: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(target.url.hostname)}&sz=32`
	const linkContent = (
		<>
			{!imageLink && <LinkFavicon key={faviconSrc} src={faviconSrc} />}
			{children}
		</>
	)
	if (!target.internal) {
		return (
			<a href={href} title={title} target="_blank" rel="noopener noreferrer">
				{linkContent}
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
	const collection =
		target.collectionSlug && Object.hasOwn(collections, target.collectionSlug)
			? collections[target.collectionSlug]
			: undefined
	return (
		<InternalContentLink
			url={target.url}
			title={title}
			project={imageLink ? undefined : project}
			collection={imageLink ? undefined : collection}
		>
			{linkContent}
		</InternalContentLink>
	)
}

function LinkFavicon({ src }: { src: string }) {
	const [failed, setFailed] = useState(false)
	if (failed) return null
	return (
		<img
			src={src}
			alt=""
			aria-hidden="true"
			width={16}
			height={16}
			loading="lazy"
			decoding="async"
			referrerPolicy="no-referrer"
			className="not-prose me-1 inline-block size-4 object-contain align-[-0.125em]"
			ref={(element) => {
				if (element?.complete) {
					void element.decode().catch(() => setFailed(true))
				}
			}}
			onError={() => setFailed(true)}
		/>
	)
}

function InternalContentLink({
	url,
	title,
	project,
	collection,
	children,
}: {
	url: URL
	title?: string
	project?: ProjectMention
	collection?: CollectionMention
	children: ReactNode
}) {
	const router = useRouter()
	const search = router.options.parseSearch(url.search)
	const hash = url.hash.slice(1)
	if (collection) {
		return (
			<CollectionHoverCard collection={collection}>
				<Badge
					variant="secondary"
					className="not-prose h-auto max-w-full gap-1.5 px-2 py-1 align-middle"
					render={
						<Link
							to="/collections/$slug"
							params={{ slug: collection.slug }}
							search={search}
							hash={hash}
							title={title}
						/>
					}
					data-collection-mention={collection.slug}
				>
					<IconFolders aria-hidden="true" />
					<span className="truncate">{collection.name}</span>
				</Badge>
			</CollectionHoverCard>
		)
	}
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
