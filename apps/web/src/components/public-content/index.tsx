import { useSuspenseQuery } from '@tanstack/react-query'
import type { ElementContent } from 'hast'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { PublicCodeBlock } from '#/components/public-content/code-block'
import { ContentLink } from '#/components/public-content/content-link'
import { ContentHeading } from '#/components/public-content/heading'
import { remarkArticleHeadings } from '#/features/public-content/headings'
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
	headingMode = 'documentation',
}: {
	slug: string
	content: string
	prepared?: PreparedPublicContent
	headingMode?: 'documentation' | 'article'
}) {
	const SecondHeading = headingMode === 'article' ? 'h2' : 'h3'
	const ThirdHeading = headingMode === 'article' ? 'h3' : 'h4'
	return (
		<article
			aria-label={
				headingMode === 'article' ? 'Article content' : 'Project documentation'
			}
			className="prose max-w-none min-w-0 wrap-anywhere prose-neutral dark:prose-invert prose-a:decoration-transparent prose-a:transition-all prose-a:duration-300 prose-a:ease-in-out prose-a:hover:decoration-current prose-a:motion-reduce:transition-none"
		>
			<Markdown
				remarkPlugins={
					headingMode === 'article'
						? [remarkGfm, remarkArticleHeadings]
						: [remarkGfm]
				}
				skipHtml
				components={{
					h1: ({ node, children, ...props }) => (
						<ContentHeading
							as="h2"
							label={node ? textContent(node) : ''}
							{...props}
						>
							{children}
						</ContentHeading>
					),
					h2: ({ node, children, ...props }) => (
						<ContentHeading
							as={SecondHeading}
							label={node ? textContent(node) : ''}
							{...props}
						>
							{children}
						</ContentHeading>
					),
					h3: ({ node, children, ...props }) => (
						<ContentHeading
							as={ThirdHeading}
							label={node ? textContent(node) : ''}
							{...props}
						>
							{children}
						</ContentHeading>
					),
					h4: ({ node, children, ...props }) => (
						<ContentHeading
							as="h4"
							label={node ? textContent(node) : ''}
							{...props}
						>
							{children}
						</ContentHeading>
					),
					h5: ({ node, children, ...props }) => (
						<ContentHeading
							as="h5"
							label={node ? textContent(node) : ''}
							{...props}
						>
							{children}
						</ContentHeading>
					),
					h6: ({ node, children, ...props }) => (
						<ContentHeading
							as="h6"
							label={node ? textContent(node) : ''}
							{...props}
						>
							{children}
						</ContentHeading>
					),
					a: ({ node, children, href, title }) => (
						<ContentLink
							node={node}
							href={href}
							title={title}
							slug={slug}
							projects={prepared.projectsBySlug}
							collections={prepared.collectionsBySlug}
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
