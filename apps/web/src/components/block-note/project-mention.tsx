import { createReactInlineContentSpec } from '@blocknote/react'
import { IconAt } from '@tabler/icons-react'

import { Badge } from '@altstack/ui/components/badge'

import { projectSlugFromPath } from '#/features/public-content/model'

export const ProjectMentionInline = createReactInlineContentSpec(
	{
		type: 'projectMention',
		propSchema: { slug: { default: '' }, name: { default: '' } },
		content: 'none',
	},
	{
		render: ({ inlineContent }) => (
			<Badge
				variant="secondary"
				className="h-auto max-w-full gap-1 px-2 py-1 align-middle"
				data-project-mention={inlineContent.props.slug}
				title={`/${inlineContent.props.slug}`}
			>
				<IconAt aria-hidden="true" />
				<span className="truncate">{inlineContent.props.name}</span>
			</Badge>
		),
		// Plain project links also work in the public renderer and Markdown tools.
		toExternalHTML: ({ inlineContent }) => (
			<a href={`/${encodeURIComponent(inlineContent.props.slug)}`}>
				{inlineContent.props.name}
			</a>
		),
		parse: (element) => {
			if (element.tagName !== 'A' || element.querySelector('img')) return
			const slug = projectSlugFromPath(element.getAttribute('href') ?? '')
			if (!slug) return
			return { slug, name: element.textContent.trim() || slug }
		},
		runsBefore: ['link'],
	}
)
