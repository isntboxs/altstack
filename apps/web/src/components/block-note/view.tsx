import '@blocknote/core/fonts/inter.css'
import '@blocknote/shadcn/style.css'
import { useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/shadcn'
import { useEffect } from 'react'

import { useTheme } from '@altstack/ui/components/customs/theme-provider'

import {
	blockNoteSchema,
	contentExtensions,
} from '#/components/block-note/schema'
import type { ReadmeImportPreview } from '#/components/block-note/schema'

interface BlockNoteViewProps {
	content?: string
	blocks?: ReadmeImportPreview['blocks']
}

export const BlockNoteViewBlocks = ({
	content,
	blocks,
}: BlockNoteViewProps) => {
	const { resolvedTheme } = useTheme()
	const editor = useCreateBlockNote({
		schema: blockNoteSchema,
		extensions: contentExtensions(),
	})

	useEffect(() => {
		const next = blocks ?? editor.tryParseMarkdownToBlocks(content ?? '')
		editor.replaceBlocks(editor.document, structuredClone(next))
	}, [content, blocks, editor])

	return (
		<BlockNoteView
			className="altstack-block-note-editor [&_.bn-container]:p-0! [&_.bn-editor]:rounded-none! [&_.bn-editor]:bg-transparent! [&_.bn-editor]:px-0!"
			editor={editor}
			editable={false}
			sideMenu={false}
			theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
		/>
	)
}
