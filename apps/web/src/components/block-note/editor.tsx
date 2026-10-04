import '@blocknote/core/fonts/inter.css'
import { BlockNoteSchema, SyntaxHighlightingExtension } from '@blocknote/core'
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
	BNCustomCodeBlock,
	DEFAULT_CODE_BLOCK_LANGUAGE,
	SUPPORTED_CODE_BLOCK_LANGUAGES,
} from '#/components/block-note/code-block'
import {
	CODE_BLOCK_SHIKI_THEME,
	createHighlighter,
	withFontStyleHtmlStyles,
} from '#/utils/shiki.bundle'

const schema = BlockNoteSchema.create().extend({
	blockSpecs: {
		codeBlock: BNCustomCodeBlock({
			indentLineWithTab: true,
			defaultLanguage: DEFAULT_CODE_BLOCK_LANGUAGE,
			supportedLanguages: SUPPORTED_CODE_BLOCK_LANGUAGES,
		}),
	},
})

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
		return {
			flush: () => {
				if (pendingExportRef.current === null) return
				window.clearTimeout(pendingExportRef.current)
				pendingExportRef.current = null
				onChangeRef.current?.(editor.blocksToMarkdownLossy(editor.document))
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
