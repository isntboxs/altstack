import { useSuspenseQuery } from '@tanstack/react-query'
import type { ElementContent } from 'hast'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { PublicCodeBlock } from '#/components/public-content/code-block'
import { ContentLink } from '#/components/public-content/content-link'
import { emptyPublicContent } from '#/features/public-content/model'
import type { PreparedPublicContent } from '#/features/public-content/model'
import { publicContentOptions } from '#/features/public-content/queries'

function textContent(node: ElementContent): string {
	if (node.type === 'text') return node.value
	return node.type === 'element' ? node.children.map(textContent).join('') : ''
}

export function ProjectContent({
	slug,
	content,
}: {
	slug: string
	content: string
}) {
	const { data } = useSuspenseQuery(publicContentOptions(slug, content))
	return <PublicContent slug={slug} content={content} prepared={data} />
}

export function PublicContent({
	slug,
	content,
	prepared = emptyPublicContent(),
}: {
	slug: string
	content: string
	prepared?: PreparedPublicContent
}) {
	return (
		<article
			aria-label="Project documentation"
			className="prose max-w-none min-w-0 wrap-anywhere prose-neutral dark:prose-invert"
		>
			<Markdown
				remarkPlugins={[remarkGfm]}
				skipHtml
				components={{
					h1: ({ children, ...props }) => <h2 id={props.id}>{children}</h2>,
					h2: ({ children, ...props }) => <h3 id={props.id}>{children}</h3>,
					h3: ({ children, ...props }) => <h4 id={props.id}>{children}</h4>,
					a: ({ node, children, href, title }) => (
						<ContentLink
							node={node}
							href={href}
							title={title}
							slug={slug}
							projects={prepared.projectsBySlug}
						>
							{children}
						</ContentLink>
					),
					pre: ({ node, children }) => {
						const code = node?.children.find(
							(child) => child.type === 'element' && child.tagName === 'code'
						)
						if (!code || code.type !== 'element') return <pre>{children}</pre>
						const offset = node?.position?.start.offset
						const block =
							offset === undefined ? undefined : prepared.codeBlocks[offset]
						const classNames = code.properties.className
						const language = Array.isArray(classNames)
							? classNames
									.find(
										(name) =>
											typeof name === 'string' && name.startsWith('language-')
									)
									?.toString()
									.slice(9)
							: undefined
						// remark-rehype appends one display newline; it is not source code.
						const plainCode = textContent(code).replace(/\n$/, '')
						return (
							<PublicCodeBlock
								key={`${offset}:${plainCode}`}
								block={
									block ?? { code: plainCode, language: language ?? 'text' }
								}
							/>
						)
					},
					table: ({ children }) => (
						<div className="overflow-x-auto">
							<table>{children}</table>
						</div>
					),
				}}
			>
				{content}
			</Markdown>
		</article>
	)
}
