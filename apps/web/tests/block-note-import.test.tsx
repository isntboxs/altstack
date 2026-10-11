import { BlockNoteEditor as CoreEditor } from '@blocknote/core'
// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import BlockNoteEditor from '#/components/block-note/editor'
import type { BlockNoteEditorHandle } from '#/components/block-note/editor'
import type { ContentEditor } from '#/components/block-note/schema'
import {
	blockNoteSchema,
	prepareReadmeImport,
} from '#/components/block-note/schema'

vi.mock('@altstack/ui/components/customs/theme-provider', () => {
	return {
		useTheme: () => {
			return { resolvedTheme: 'light' }
		},
	}
})
vi.mock('@blocknote/shadcn', () => {
	return {
		BlockNoteView: ({
			editor,
			onChange,
		}: {
			editor: ContentEditor
			onChange?: () => void
		}) => (
			<button
				type="button"
				onClick={() => {
					editor.updateBlock(editor.document[0], { content: 'Last keystroke' })
					onChange?.()
				}}
			>
				Type final edit
			</button>
		),
	}
})
afterEach(() => {
	cleanup()
	vi.useRealTimers()
})

describe('real BlockNote import and export', () => {
	it('flushes the last same-task edit before reading/importing, and the value prop never overwrites edits', () => {
		vi.useFakeTimers()
		const ref = createRef<BlockNoteEditorHandle>()
		const change = vi.fn()
		const view = render(
			<BlockNoteEditor ref={ref} value="Initial content" onChange={change} />
		)
		fireEvent.click(screen.getByRole('button', { name: 'Type final edit' }))
		expect(change).not.toHaveBeenCalled()
		let preview!: ReturnType<BlockNoteEditorHandle['previewImport']>
		act(() => {
			preview = ref.current!.previewImport('# README', 'append')
		})
		expect(change).toHaveBeenLastCalledWith(
			expect.stringContaining('Last keystroke')
		)
		expect(preview.markdown).toContain('Last keystroke')
		expect(preview.markdown).toContain('# README')
		act(() => {
			expect(
				ref.current!.importMarkdown('# README', 'append', preview.markdown)
					.applied
			).toBe(true)
		})
		expect(change).toHaveBeenLastCalledWith(preview.markdown)
		view.rerender(
			<BlockNoteEditor
				ref={ref}
				value="External stale value"
				onChange={change}
			/>
		)
		let current = ''
		act(() => {
			current = ref.current!.readMarkdown()
		})
		expect(current).toContain('Last keystroke')
		expect(current).toContain('# README')
		expect(current).not.toContain('External stale value')
	})
	it('flushes before Save and exports code blocks with their language and content intact', () => {
		vi.useFakeTimers()
		const ref = createRef<BlockNoteEditorHandle>()
		const change = vi.fn()
		render(
			<BlockNoteEditor
				ref={ref}
				value={'Original\n\n```typescript\nconst url = "../local.png"\n```'}
				onChange={change}
			/>
		)
		fireEvent.click(screen.getByRole('button', { name: 'Type final edit' }))
		act(() => {
			ref.current!.flush()
		})
		const markdown = change.mock.calls.at(-1)?.[0] as string
		expect(markdown).toContain('Last keystroke')
		expect(markdown).toContain('```typescript')
		expect(markdown).toContain('const url = "../local.png"')
	})
	it('preview, imported editor and saved public parser preserve the same supported blocks, including code and tables', () => {
		const editor = CoreEditor.create({ schema: blockNoteSchema })
		try {
			editor.replaceBlocks(
				editor.document,
				editor.tryParseMarkdownToBlocks('Existing content')
			)
			const preview = prepareReadmeImport(
				editor,
				'# Title\n\n```js\nconsole.log("safe")\n```\n\n| A | B |\n| --- | --- |\n| 1 | 2 |',
				'append'
			)
			editor.replaceBlocks(editor.document, preview.blocks)
			expect(editor.blocksToMarkdownLossy(editor.document)).toBe(
				preview.markdown
			)
			const publicBlocks = editor.tryParseMarkdownToBlocks(preview.markdown)
			expect(publicBlocks.map((block) => block.type)).toContain('codeBlock')
			expect(publicBlocks.map((block) => block.type)).toContain('table')
			expect(editor.blocksToMarkdownLossy(publicBlocks)).toBe(preview.markdown)
		} finally {
			editor._tiptapEditor.destroy()
		}
	})
	it('empty conversion fails without replacing existing document or form content', () => {
		const ref = createRef<BlockNoteEditorHandle>()
		const change = vi.fn()
		render(<BlockNoteEditor ref={ref} value="Existing" onChange={change} />)
		act(() => {
			ref.current!.flush()
		})
		const before = ref.current!.readMarkdown()
		expect(() => ref.current!.previewImport('', 'replace')).toThrow(
			/no supported content/
		)
		expect(ref.current!.readMarkdown()).toBe(before)
	})
})
