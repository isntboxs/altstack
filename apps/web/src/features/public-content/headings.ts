import type { Nodes, Root } from 'mdast'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'

export interface ArticleHeading {
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
	const headings: Array<ArticleHeading> = []
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

export function articleHeadings(content: string) {
	return annotateHeadings(
		unified().use(remarkParse).use(remarkGfm).parse(content)
	)
}

export function remarkArticleHeadings() {
	return (tree: Root) => {
		annotateHeadings(tree)
	}
}
