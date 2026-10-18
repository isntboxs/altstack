import { log } from 'evlog'
import type { Code } from 'mdast'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'

import { publicProjectMentions } from '@altstack/api/queries/project-mentions'

import { env } from '@altstack/env/web'

import {
	contentLink,
	emptyPublicContent,
} from '#/features/public-content/model'
import type { PreparedCodeBlock } from '#/features/public-content/model'
import { bundledLanguages, getSingletonHighlighter } from '#/utils/shiki.bundle'
import type { BundledLanguage } from '#/utils/shiki.bundle'

const parser = unified().use(remarkParse).use(remarkGfm)

function isBundledLanguage(language: string): language is BundledLanguage {
	return Object.hasOwn(bundledLanguages, language)
}

async function highlight(node: Code): Promise<PreparedCodeBlock> {
	const language = node.lang?.toLowerCase() ?? 'text'
	const block: PreparedCodeBlock = { code: node.value, language }
	if (!isBundledLanguage(language)) return block
	try {
		const highlighter = await getSingletonHighlighter({
			themes: ['github-light', 'github-dark'],
			langs: [language],
		})
		const tokens = highlighter.codeToTokensWithThemes(node.value, {
			lang: language,
			themes: { light: 'github-light', dark: 'github-dark' },
		})
		block.tokens = tokens.map((line) =>
			line.map((token) => {
				return {
					content: token.content,
					light: token.variants.light,
					dark: token.variants.dark,
				}
			})
		)
		const light = highlighter.getTheme('github-light')
		const dark = highlighter.getTheme('github-dark')
		block.colors = {
			light: { color: light.fg, bgColor: light.bg },
			dark: { color: dark.fg, bgColor: dark.bg },
		}
	} catch {
		log.warn({ action: 'public_content_highlight_failed', language })
	}
	return block
}

export async function prepareContent(input: { slug: string; content: string }) {
	const result = emptyPublicContent()
	const tree = parser.parse(input.content)
	const definitions = new Map<string, string>()
	visit(tree, 'definition', (node) => {
		if (!definitions.has(node.identifier)) {
			definitions.set(node.identifier, node.url)
		}
	})
	const slugs = new Set<string>()
	const code: Array<Code> = []
	visit(tree, (node) => {
		if (node.type === 'code') code.push(node)
		if (node.type !== 'link' && node.type !== 'linkReference') return
		if (
			node.children.some(
				(child) => child.type === 'image' || child.type === 'imageReference'
			)
		) {
			return
		}
		const href =
			node.type === 'link' ? node.url : definitions.get(node.identifier)
		const slug =
			href && contentLink(href, input.slug, env.VITE_APP_URL)?.projectSlug
		if (slug) slugs.add(slug)
	})
	await Promise.all([
		...code.map(async (node) => {
			const offset = node.position?.start.offset
			if (offset !== undefined) {
				result.codeBlocks[offset] = await highlight(node)
			}
		}),
		(async () => {
			try {
				const projects = await publicProjectMentions([...slugs])
				result.projectsBySlug = Object.fromEntries(
					projects.map((project) => [project.slug, project])
				)
			} catch {
				log.warn({ action: 'public_content_mentions_failed', slug: input.slug })
			}
		})(),
	])
	return result
}
