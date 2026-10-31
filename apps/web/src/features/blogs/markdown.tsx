import type { Nodes, Root } from 'mdast'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'

export interface BlogHeading {
	id: string
	title: string
	depth: number
}

function headingText(node: Nodes): string {
	if ('value' in node && (node.type === 'text' || node.type === 'inlineCode')) {
		return node.value
	}
	if (node.type === 'image') return node.alt ?? ''
	return 'children' in node ? node.children.map(headingText).join('') : ''
}

function annotateHeadings(tree: Root) {
	const headings: Array<BlogHeading> = []
	let index = 0
	visit(tree, 'heading', (node) => {
		const title = headingText(node)
		const slug =
			title
				.toLowerCase()
				.normalize('NFKD')
				.replace(/\p{M}/gu, '')
				.replace(/[^\p{L}\p{N}\s-]/gu, '')
				.trim()
				.replace(/[\s-]+/g, '-') || 'section'
		const id = `${slug}-${index++}`
		node.data = {
			...node.data,
			hProperties: {
				...node.data?.hProperties,
				id,
				tabIndex: -1,
				className: ['scroll-mt-24'],
			},
		}
		if (node.depth <= 3 && title.trim()) {
			headings.push({ id, title, depth: Math.max(2, node.depth) })
		}
	})
	return headings
}

export function blogHeadings(content: string) {
	return annotateHeadings(
		unified().use(remarkParse).use(remarkGfm).parse(content)
	)
}

function remarkBlogHeadings() {
	return (tree: Root) => {
		annotateHeadings(tree)
	}
}

export function BlogMarkdown({ content }: { content: string }) {
	return (
		<div className="prose max-w-none min-w-0 wrap-anywhere prose-neutral dark:prose-invert prose-headings:scroll-mt-24 prose-pre:overflow-x-auto prose-img:rounded-lg">
			<Markdown
				remarkPlugins={[remarkGfm, remarkBlogHeadings]}
				skipHtml
				components={{
					h1: ({ children, id }) => (
						<h2 id={id} tabIndex={-1}>
							{children}
						</h2>
					),
					a: ({ href, children }) => (
						<a
							href={href}
							{...(href?.startsWith('https://') || href?.startsWith('http://')
								? { target: '_blank', rel: 'noopener noreferrer' }
								: {})}
						>
							{children}
						</a>
					),
					table: ({ children }) => (
						<div className="overflow-x-auto">
							<table>{children}</table>
						</div>
					),
				}}
			>
				{content}
			</Markdown>
		</div>
	)
}
