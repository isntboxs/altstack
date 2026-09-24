import '@blocknote/core/fonts/inter.css'
import { BlockNoteSchema, SyntaxHighlightingExtension } from '@blocknote/core'
import { useCreateBlockNote } from '@blocknote/react'
import '@blocknote/shadcn/style.css'
import { BlockNoteView } from '@blocknote/shadcn'
import { cn } from 'cn'
import { useEffect, useRef } from 'react'

import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from '@altstack/ui/components/avatar'
import { Badge } from '@altstack/ui/components/badge'
import { Button } from '@altstack/ui/components/button'
import { Card, CardContent } from '@altstack/ui/components/card'
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
}

export default function BlockNoteEditor({
	value,
	onChange,
	onBlur,
	className,
}: Props) {
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

	const handleMarkdownChange = () => {
		const markdown = editor.blocksToMarkdownLossy(editor.document)
		onChange?.(markdown)
	}

	return (
		<BlockNoteView
			className={cn(
				'altstack-block-note-editor [&_.bn-editor]:rounded-none! [&_.bn-editor]:bg-transparent! [&_.bn-editor]:px-0!',
				className
			)}
			editor={editor}
			sideMenu={false}
			onBlur={onBlur}
			onChange={handleMarkdownChange}
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
