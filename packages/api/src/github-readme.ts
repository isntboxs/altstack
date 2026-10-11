import type { Root } from 'hast'
import rehypeRaw from 'rehype-raw'
import rehypeRemark from 'rehype-remark'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import type { Options as SanitizeOptions } from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import remarkStringify from 'remark-stringify'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'

export const MAX_README_BYTES = 100 * 1024

const supportedTags = [
	'p',
	'br',
	'hr',
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
	'ul',
	'ol',
	'li',
	'blockquote',
	'pre',
	'code',
	'strong',
	'b',
	'em',
	'i',
	'del',
	's',
	'a',
	'img',
	'table',
	'thead',
	'tbody',
	'tr',
	'th',
	'td',
	'input',
]
const unsafeTags = [
	'script',
	'style',
	'iframe',
	'object',
	'embed',
	'svg',
	'math',
	'template',
]

const readmeSchema: SanitizeOptions = {
	...defaultSchema,
	tagNames: supportedTags,
	strip: [...(defaultSchema.strip ?? []), ...unsafeTags],
	attributes: {
		a: ['href', 'title'],
		img: ['src', 'alt', 'title'],
		ol: ['start'],
		li: [['className', 'task-list-item']],
		ul: [['className', 'contains-task-list']],
		input: [['type', 'checkbox'], 'checked', 'disabled'],
		code: [['className', /^language-./]],
	},
	protocols: { href: ['http', 'https', 'mailto'], src: ['http', 'https'] },
}

// Repository paths are data, not already URL-encoded strings.
export function encodeGithubPath(path: string) {
	return path.split('/').map(encodeURIComponent).join('/')
}

export function normalizeGithubReadme(
	markdown: string,
	context: { repositoryUrl: string; path: string; commitSha: string }
) {
	const warnings = new Set<string>()
	const repository = new URL(context.repositoryUrl).pathname
	const sourceUrl = `${context.repositoryUrl}/blob/${context.commitSha}/${encodeGithubPath(context.path)}`
	const fileBase = new URL(
		`https://readme.invalid/${encodeGithubPath(context.path)}`
	)

	function resolveUrl(value: string, image: boolean): string | undefined {
		const url = value.trim()
		// Reject control characters and backslashes before URL parsing can hide them.
		if (
			!url ||
			url.includes('\\') ||
			[...url].some(
				(character) =>
					character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
			)
		) {
			return undefined
		}
		try {
			if (/^[a-z][a-z\d+.-]*:/i.test(url) || url.startsWith('//')) {
				const absolute = new URL(url.startsWith('//') ? `https:${url}` : url)
				if (
					!['http:', 'https:', ...(image ? [] : ['mailto:'])].includes(
						absolute.protocol
					)
				) {
					return undefined
				}
				return absolute.href
			}
			if (!image && url.startsWith('#')) return sourceUrl + url
			// Resolve on a dummy origin first so ../ can never escape the pinned
			// repository/commit prefix. URL preserves query, fragment and encoding.
			const relative = new URL(url, fileBase)
			if (relative.origin !== fileBase.origin) return undefined
			const base = image
				? `https://raw.githubusercontent.com${repository}/${context.commitSha}`
				: `${context.repositoryUrl}/blob/${context.commitSha}`
			return base + relative.pathname + relative.search + relative.hash
		} catch {
			return undefined
		}
	}

	function prepareHtml() {
		return (tree: Root) => {
			visit(tree, 'element', (node) => {
				if (unsafeTags.includes(node.tagName)) {
					warnings.add('Unsafe embedded content was removed.')
				} else if (!supportedTags.includes(node.tagName)) {
					warnings.add(
						'GitHub-specific HTML layout was removed; supported text was kept.'
					)
				}
				for (const key of Object.keys(node.properties)) {
					if (/^on/i.test(key)) {
						warnings.add('Unsafe HTML event handlers were removed.')
					}
					if (
						['align', 'style', 'width', 'height', 'id'].includes(key) ||
						(key === 'className' &&
							!['code', 'li', 'ul'].includes(node.tagName))
					) {
						warnings.add(
							'Custom HTML styling, alignment and layout were removed.'
						)
					}
				}
				const key =
					node.tagName === 'a' ? 'href' : node.tagName === 'img' ? 'src' : null
				if (!key || typeof node.properties[key] !== 'string') return
				const resolved = resolveUrl(node.properties[key], key === 'src')
				if (resolved) node.properties[key] = resolved
				else {
					delete node.properties[key]
					warnings.add('Unsafe or invalid links and images were removed.')
					// An image without a safe source must not become a relative image.
					if (node.tagName === 'img') {
						node.tagName = 'span'
						node.children = [
							{ type: 'text', value: String(node.properties.alt ?? '') },
						]
						node.properties = {}
					}
				}
			})
		}
	}

	const parser = unified().use(remarkParse).use(remarkGfm)
	const tree = parser.parse(markdown.replace(/\r\n?/g, '\n'))
	visit(tree, 'html', () => {
		warnings.add(
			'Basic HTML was converted to Markdown. GitHub-specific formatting may change.'
		)
	})
	const processor = parser()
		.use(remarkRehype, { allowDangerousHtml: true })
		.use(rehypeRaw)
		.use(prepareHtml)
		.use(rehypeSanitize, readmeSchema)
		.use(rehypeRemark)
		.use(remarkStringify, { fences: true, bullet: '-', listItemIndent: 'one' })
	const normalized = processor.stringify(processor.runSync(tree)).trim()
	return { markdown: normalized, warnings: [...warnings], sourceUrl }
}
