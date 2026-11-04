import { createReactInlineContentSpec } from '@blocknote/react'
import { IconFolders } from '@tabler/icons-react'

import { Badge } from '@altstack/ui/components/badge'

import { collectionSlugFromPath } from '#/features/public-content/model'

export const CollectionMentionInline = createReactInlineContentSpec(
	{
		type: 'collectionMention',
		propSchema: { slug: { default: '' }, name: { default: '' } },
		content: 'none',
	},
	{
		render: ({ inlineContent }) => (
			<Badge
				variant="secondary"
				className="h-auto max-w-full gap-1 px-2 py-1 align-middle"
				data-collection-mention={inlineContent.props.slug}
				title={`/collections/${inlineContent.props.slug}`}
			>
				<IconFolders aria-hidden="true" />
				<span className="truncate">{inlineContent.props.name}</span>
			</Badge>
		),
		toExternalHTML: ({ inlineContent }) => (
			<a href={`/collections/${encodeURIComponent(inlineContent.props.slug)}`}>
				{inlineContent.props.name}
			</a>
		),
		parse: (element) => {
			if (element.tagName !== 'A' || element.querySelector('img')) return
			const slug = collectionSlugFromPath(element.getAttribute('href') ?? '')
			if (!slug) return
			return { slug, name: element.textContent.trim() || slug }
		},
		runsBefore: ['link'],
	}
)
