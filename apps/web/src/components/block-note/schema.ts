import { BlockNoteSchema, SyntaxHighlightingExtension } from '@blocknote/core'
import type { BlockNoteEditor, InlineContent } from '@blocknote/core'

import {
	BNCustomCodeBlock,
	DEFAULT_CODE_BLOCK_LANGUAGE,
	SUPPORTED_CODE_BLOCK_LANGUAGES,
} from '#/components/block-note/code-block'
import { ProjectMentionInline } from '#/components/block-note/project-mention'
import { projectSlugFromPath } from '#/features/public-content/model'
import {
	CODE_BLOCK_SHIKI_THEME,
	createHighlighter,
	withFontStyleHtmlStyles,
} from '#/utils/shiki.bundle'

export const blockNoteSchema = BlockNoteSchema.create().extend({
	inlineContentSpecs: { projectMention: ProjectMentionInline },
	blockSpecs: {
		codeBlock: BNCustomCodeBlock({
			indentLineWithTab: true,
			defaultLanguage: DEFAULT_CODE_BLOCK_LANGUAGE,
			supportedLanguages: SUPPORTED_CODE_BLOCK_LANGUAGES,
		}),
	},
})

export function contentExtensions() {
	return [
		SyntaxHighlightingExtension({
			createHighlighter: () =>
				createHighlighter({ themes: [CODE_BLOCK_SHIKI_THEME], langs: [] }).then(
					withFontStyleHtmlStyles
				),
		}),
	]
}

export type ContentEditor = BlockNoteEditor<
	typeof blockNoteSchema.blockSchema,
	typeof blockNoteSchema.inlineContentSchema,
	typeof blockNoteSchema.styleSchema
>
export type ReadmeImportMode = 'replace' | 'append'
export type ReadmeImportPreview = {
	markdown: string
	blocks: Parameters<ContentEditor['replaceBlocks']>[1]
}

type ContentInline = InlineContent<
	typeof blockNoteSchema.inlineContentSchema,
	typeof blockNoteSchema.styleSchema
>

function restoreProjectMentions(
	content: Array<ContentInline>
): Array<ContentInline> {
	return content.map((inline) => {
		if (inline.type !== 'link') return inline
		const slug = projectSlugFromPath(inline.href)
		if (!slug) return inline
		return {
			type: 'projectMention',
			content: undefined,
			props: {
				slug,
				name: inline.content.map((text) => text.text).join('') || slug,
			},
		} satisfies ContentInline
	})
}

// BlockNote's Markdown parser returns built-in links rather than custom inline
// content. Restore project atoms in every editable location after parsing.
export function parseContentMarkdown(editor: ContentEditor, markdown: string) {
	const blocks = editor.tryParseMarkdownToBlocks(markdown)
	const restore = (items: typeof blocks) => {
		for (const block of items) {
			if (Array.isArray(block.content)) {
				block.content = restoreProjectMentions(block.content)
			} else if (block.type === 'table') {
				for (const row of block.content.rows) {
					for (const cell of row.cells) {
						const content = Array.isArray(cell) ? cell : cell.content
						content.splice(
							0,
							content.length,
							...restoreProjectMentions(content)
						)
					}
				}
			}
			restore(block.children)
		}
	}
	restore(blocks)
	return blocks
}

// Called only from event handlers/async continuations, where React is idle.
// Markdown export renders custom blocks through React's flushSync.
export function prepareReadmeImport(
	editor: ContentEditor,
	markdown: string,
	mode: ReadmeImportMode
): ReadmeImportPreview {
	const imported = parseContentMarkdown(editor, markdown)
	if (!editor.blocksToMarkdownLossy(imported).trim()) {
		throw new Error(
			'README has no supported content after BlockNote conversion.'
		)
	}
	const current = editor.blocksToMarkdownLossy(editor.document).trim()
	const blocks: ReadmeImportPreview['blocks'] =
		mode === 'append' && current
			? [...editor.document, { type: 'paragraph' }, ...imported]
			: imported
	// Reparse the export so preview, Apply and the saved public view use the
	// same normalized document. Markdown preserves paragraph separation but
	// does not preserve an extra empty BlockNote paragraph.
	const normalizedBlocks = parseContentMarkdown(
		editor,
		editor.blocksToMarkdownLossy(blocks)
	)
	return {
		blocks: normalizedBlocks,
		markdown: editor.blocksToMarkdownLossy(normalizedBlocks),
	}
}
