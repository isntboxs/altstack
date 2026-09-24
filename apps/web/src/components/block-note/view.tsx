import '@blocknote/core/fonts/inter.css'
import '@blocknote/shadcn/style.css'
import { BlockNoteSchema, SyntaxHighlightingExtension } from '@blocknote/core'
import { useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/shadcn'
import { useEffect } from 'react'

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

interface BlockNoteViewProps {
	content: string
}

const schema = BlockNoteSchema.create().extend({
	blockSpecs: {
		codeBlock: BNCustomCodeBlock({
			indentLineWithTab: true,
			defaultLanguage: DEFAULT_CODE_BLOCK_LANGUAGE,
			supportedLanguages: SUPPORTED_CODE_BLOCK_LANGUAGES,
		}),
	},
})

export const BlockNoteViewBlocks = ({ content }: BlockNoteViewProps) => {
	const editor = useCreateBlockNote({
		schema,
		extensions: [
			SyntaxHighlightingExtension({
				createHighlighter: () =>
					createHighlighter({
						themes: [CODE_BLOCK_SHIKI_THEME],
						langs: [],
					}).then(withFontStyleHtmlStyles),
			}),
		],
	})

	useEffect(() => {
		const blocks = editor.tryParseMarkdownToBlocks(content)
		editor.replaceBlocks(editor.document, blocks)
	}, [content, editor])

	return (
		<BlockNoteView
			className="[&_.bn-container]:p-0! [&_.bn-editor]:rounded-none! [&_.bn-editor]:bg-transparent! [&_.bn-editor]:px-0!"
			editor={editor}
			editable={false}
			sideMenu={false}
		/>
	)
}
