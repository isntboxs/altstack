import { BlockNoteSchema, SyntaxHighlightingExtension } from '@blocknote/core'
import type { BlockNoteEditor } from '@blocknote/core'

import {
	BNCustomCodeBlock,
	DEFAULT_CODE_BLOCK_LANGUAGE,
	SUPPORTED_CODE_BLOCK_LANGUAGES,
} from '#/components/block-note/code-block'
import {
	CODE_BLOCK_SHIKI_THEME,
	createHighlighter,
	withFontStyleHtmlStyles,
} from '#/utils/shiki.bundle'

export const blockNoteSchema = BlockNoteSchema.create().extend({
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

// Called only from event handlers/async continuations, where React is idle.
// Markdown export renders custom blocks through React's flushSync.
export function prepareReadmeImport(
	editor: ContentEditor,
	markdown: string,
	mode: ReadmeImportMode
): ReadmeImportPreview {
	const imported = editor.tryParseMarkdownToBlocks(markdown)
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
	const normalizedBlocks = editor.tryParseMarkdownToBlocks(
		editor.blocksToMarkdownLossy(blocks)
	)
	return {
		blocks: normalizedBlocks,
		markdown: editor.blocksToMarkdownLossy(normalizedBlocks),
	}
}
