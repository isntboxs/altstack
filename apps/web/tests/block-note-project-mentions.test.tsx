// @vitest-environment jsdom
import { BlockNoteEditor } from '@blocknote/core'
import { describe, expect, it } from 'vite-plus/test'

import {
	blockNoteSchema,
	prepareReadmeImport,
	parseContentMarkdown,
} from '#/components/block-note/schema'

describe('project mention Markdown compatibility', () => {
	it('round-trips collection and project mentions together through lists, tables and README append', () => {
		const editor = BlockNoteEditor.create({ schema: blockNoteSchema })
		const mention = {
			type: 'collectionMention',
			props: { slug: 'frontend-tools', name: 'Frontend [tools] & friends' },
		} as const
		editor.replaceBlocks(editor.document, [
			{ type: 'paragraph', content: ['Explore ', mention] },
		])
		const markdown = editor.blocksToMarkdownLossy(editor.document)
		expect(markdown).toContain('](/collections/frontend-tools)')
		expect(parseContentMarkdown(editor, markdown)[0].content).toContainEqual(
			mention
		)
		const preview = prepareReadmeImport(
			editor,
			'- [Tools](/collections/frontend-tools)\n  - [Vite](/vite)\n\n| Collections |\n| --- |\n| [Web](/collections/web) |',
			'append'
		)
		expect(
			JSON.stringify(preview.blocks).match(/"type":"collectionMention"/g)
		).toHaveLength(3)
		expect(JSON.stringify(preview.blocks)).toContain('"type":"projectMention"')
		expect(
			editor.blocksToMarkdownLossy(
				parseContentMarkdown(editor, preview.markdown)
			)
		).toBe(preview.markdown)
	})

	it.each([
		'`[Tools](/collections/frontend)`',
		'```text\n[Tools](/collections/frontend)\n```',
		'[![Badge](https://img.test/badge.svg)](/collections/frontend)',
		'[external](https://other.test/collections/frontend)',
		'[relative](collections/frontend)',
		'[nested](/collections/frontend/edit)',
		'[directory](/collections)',
		'[fragment](/collections/frontend#details)',
	])('does not convert non-mention collection content: %s', (markdown) => {
		const editor = BlockNoteEditor.create({ schema: blockNoteSchema })
		expect(
			JSON.stringify(parseContentMarkdown(editor, markdown))
		).not.toContain('"type":"collectionMention"')
	})
	it('restores nested list and table mentions while leaving code and image links intact', () => {
		const editor = BlockNoteEditor.create({ schema: blockNoteSchema })
		const markdown =
			'- Parent\n  - [OXC](/oxc)\n\n| Tool |\n| --- |\n| [Vite](/vite) |\n\n`[Vite](/vite)`\n\n```text\n[Vite](/vite)\n```\n\n[![Badge](https://img.test/badge.svg)](/vite)'
		const blocks = parseContentMarkdown(editor, markdown)
		expect(
			JSON.stringify(blocks).match(/"type":"projectMention"/g)
		).toHaveLength(2)
		const exported = editor.blocksToMarkdownLossy(blocks)
		expect(exported).toContain('`[Vite](/vite)`')
		expect(exported).toContain('```text\n[Vite](/vite)')
		expect(exported).toContain('![Badge]')
	})
	it('exports a portable link and restores the same custom inline mention after reopening', () => {
		const editor = BlockNoteEditor.create({ schema: blockNoteSchema })
		const mention = {
			type: 'projectMention',
			props: { slug: 'tool-next', name: 'Tool [next] & "Friends"' },
		} as const
		editor.replaceBlocks(editor.document, [
			{ type: 'paragraph', content: ['Built with ', mention, ' today.'] },
		])
		const markdown = editor.blocksToMarkdownLossy(editor.document)
		expect(markdown).toContain('](/tool-next)')
		expect(markdown).not.toContain('<span')
		const blocks = parseContentMarkdown(editor, markdown)
		expect(blocks[0].content).toContainEqual(mention)
		expect(editor.blocksToMarkdownLossy(blocks)).toBe(markdown)
	})

	it('preserves mentions through README append and normalization, including lists', () => {
		const editor = BlockNoteEditor.create({ schema: blockNoteSchema })
		const markdown =
			'- Built with [Vite](/vite)\n\nRegular [website](https://vite.dev)'
		editor.replaceBlocks(
			editor.document,
			parseContentMarkdown(editor, markdown)
		)
		const preview = prepareReadmeImport(
			editor,
			'# More documentation',
			'append'
		)
		expect(preview.blocks[0].content).toContainEqual({
			type: 'projectMention',
			props: { slug: 'vite', name: 'Vite' },
		})
		expect(preview.markdown).toContain('/vite')
		expect(preview.markdown).toContain('https://vite.dev')
		expect(preview.markdown).toContain('# More documentation')
	})

	it.each([
		'[ordinary](relative-readme-path)',
		'[external](https://other.test/vite)',
		'[external](//other.test/vite)',
		'[nested](/projects/create)',
		'[reserved](/categories)',
		'[image badge](/vite#details)',
	])('leaves ordinary and invalid links as links: %s', (markdown) => {
		const editor = BlockNoteEditor.create({ schema: blockNoteSchema })
		const blocks = parseContentMarkdown(editor, markdown)
		expect(JSON.stringify(blocks)).not.toContain('"type":"projectMention"')
		expect(JSON.stringify(blocks)).toContain('"type":"link"')
	})
})
