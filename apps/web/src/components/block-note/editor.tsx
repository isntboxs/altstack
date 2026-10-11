import '@blocknote/core/fonts/inter.css'
import { useCreateBlockNote } from '@blocknote/react'
import '@blocknote/shadcn/style.css'
import { BlockNoteView } from '@blocknote/shadcn'
import { cn } from 'cn'
import { useEffect, useImperativeHandle, useRef } from 'react'
import type { Ref } from 'react'

import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from '@altstack/ui/components/avatar'
import { Badge } from '@altstack/ui/components/badge'
import { Button } from '@altstack/ui/components/button'
import { Card, CardContent } from '@altstack/ui/components/card'
import { useTheme } from '@altstack/ui/components/customs/theme-provider'
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
	DropdownMenuGroup,
} from '@altstack/ui/components/dropdown-menu'
import { Input } from '@altstack/ui/components/input'
import { Label } from '@altstack/ui/components/label'
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@altstack/ui/components/popover'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@altstack/ui/components/select'
import { Skeleton } from '@altstack/ui/components/skeleton'
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from '@altstack/ui/components/tabs'
import { Toggle } from '@altstack/ui/components/toggle'
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@altstack/ui/components/tooltip'

import {
	blockNoteSchema,
	contentExtensions,
	prepareReadmeImport,
} from '#/components/block-note/schema'
import type {
	ReadmeImportMode,
	ReadmeImportPreview,
} from '#/components/block-note/schema'

interface Props {
	value?: string
	onChange?: (value: string) => void
	onBlur?: () => void
	className?: string
	ref?: Ref<BlockNoteEditorHandle>
}

export interface BlockNoteEditorHandle {
	// Runs the scheduled markdown export immediately. Call before reading
	// the field value (e.g. form submit) so the latest edits are included.
	// Safe outside BlockNote's change callback, where React is idle.
	flush: () => void
	readMarkdown: () => string
	previewImport: (
		markdown: string,
		mode: ReadmeImportMode
	) => ReadmeImportPreview
	importMarkdown: (
		markdown: string,
		mode: ReadmeImportMode,
		expectedMarkdown: string
	) => ReadmeImportPreview & { applied: boolean }
}

export default function BlockNoteEditor({
	value,
	onChange,
	onBlur,
	className,
	ref,
}: Props) {
	const { resolvedTheme } = useTheme()
	const editor = useCreateBlockNote({
		schema: blockNoteSchema,
		extensions: contentExtensions(),
	})

	// Initial content loads once: re-running on every parent value change
	// would wipe the user's in-progress edits.
	const didLoadInitialContent = useRef(false)

	useEffect(() => {
		if (didLoadInitialContent.current) return
		didLoadInitialContent.current = true

		const blocks = editor.tryParseMarkdownToBlocks(value ?? '')
		editor.replaceBlocks(editor.document, blocks)
	}, [editor, value])

	// Latest onChange without resubscribing the deferred export below.
	const onChangeRef = useRef(onChange)

	useEffect(() => {
		onChangeRef.current = onChange
	})

	const pendingExportRef = useRef<number | null>(null)

	useEffect(
		() => () => {
			if (pendingExportRef.current !== null) {
				clearTimeout(pendingExportRef.current)
			}
		},
		[]
	)

	const handleMarkdownChange = () => {
		// Exporting renders blocks to HTML through React (elementRenderer +
		// flushSync), which React forbids while it is already rendering. The
		// change callback fires mid-commit, so defer to a macrotask where
		// React is idle — otherwise the render no-ops, warns, and silently
		// drops content (e.g. code blocks) from the markdown.
		// Coalesced: rapid changes export only the latest document state.
		if (pendingExportRef.current !== null) return
		pendingExportRef.current = window.setTimeout(() => {
			pendingExportRef.current = null
			onChangeRef.current?.(editor.blocksToMarkdownLossy(editor.document))
		}, 0)
	}

	// Flushes a pending scheduled export synchronously. A submit in the same
	// task as the last keystroke would otherwise read the field before the
	// macrotask above runs and silently drop the latest edits.
	useImperativeHandle(ref, () => {
		const cancelExport = () => {
			if (pendingExportRef.current === null) return
			window.clearTimeout(pendingExportRef.current)
			pendingExportRef.current = null
		}
		const flush = () => {
			if (pendingExportRef.current === null) return
			cancelExport()
			onChangeRef.current?.(editor.blocksToMarkdownLossy(editor.document))
		}
		return {
			flush,
			readMarkdown: () => {
				flush()
				return editor.blocksToMarkdownLossy(editor.document)
			},
			previewImport: (markdown, mode) => {
				flush()
				return prepareReadmeImport(editor, markdown, mode)
			},
			importMarkdown: (markdown, mode, expectedMarkdown) => {
				flush()
				const preview = prepareReadmeImport(editor, markdown, mode)
				// Recheck the latest document. If it changed, review the new preview
				// before applying rather than overwriting unseen edits.
				if (preview.markdown !== expectedMarkdown) {
					return { ...preview, applied: false }
				}
				editor.replaceBlocks(editor.document, preview.blocks)
				cancelExport()
				onChangeRef.current?.(preview.markdown)
				return { ...preview, applied: true }
			},
		}
	}, [editor])

	return (
		<BlockNoteView
			className={cn(
				'altstack-block-note-editor min-h-64 [&_.bn-editor]:rounded-none! [&_.bn-editor]:bg-transparent! [&_.bn-editor]:px-0!',
				className
			)}
			editor={editor}
			sideMenu={false}
			onBlur={onBlur}
			onChange={handleMarkdownChange}
			theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
			shadCNComponents={{
				Avatar: {
					Avatar,
					AvatarFallback,
					AvatarImage,
				},
				Badge: {
					Badge,
				},
				Button: {
					Button,
				},
				Card: {
					Card,
					CardContent,
				},
				DropdownMenu: {
					DropdownMenu,
					DropdownMenuCheckboxItem,
					DropdownMenuContent,
					DropdownMenuGroup,
					DropdownMenuItem,
					DropdownMenuLabel,
					DropdownMenuSeparator,
					DropdownMenuSub,
					DropdownMenuSubContent,
					DropdownMenuSubTrigger,
					DropdownMenuTrigger,
				},
				Input: {
					Input,
				},
				Label: {
					Label,
				},
				Popover: {
					Popover,
					PopoverContent,
					PopoverTrigger,
				},
				Select: {
					Select,
					SelectContent,
					SelectItem,
					SelectTrigger,
					SelectValue,
				},
				Skeleton: {
					Skeleton,
				},
				Tabs: {
					Tabs,
					TabsContent,
					TabsList,
					TabsTrigger,
				},
				Toggle: {
					Toggle,
				},
				Tooltip: {
					Tooltip,
					TooltipContent,
					TooltipProvider,
					TooltipTrigger,
				},
			}}
		/>
	)
}
