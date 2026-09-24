import { createCodeBlockConfig, createCodeBlockSpec } from '@blocknote/core'
import type { CodeBlockOptions } from '@blocknote/core'
import { createReactBlockSpec } from '@blocknote/react'
import type { ReactCustomBlockRenderProps } from '@blocknote/react'
import { IconCheck, IconCopy, IconTrash } from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

import { Button } from '@altstack/ui/components/button'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@altstack/ui/components/select'
import { toast } from '@altstack/ui/components/toast'

import { SHIKI_BUNDLED_LANGUAGE_GROUPS } from '#/utils/shiki.bundle'

export const DEFAULT_CODE_BLOCK_LANGUAGE = 'javascript'
export const CODE_BLOCK_FONT_FAMILY = 'var(--font-mono)'
export const CODE_BLOCK_FONT_SIZE = '0.9375rem'
export const CODE_BLOCK_LINE_HEIGHT = '1.8'

export const CODE_BLOCK_LANGUAGES = [
	{ id: 'text', name: 'Plain Text' },
	...SHIKI_BUNDLED_LANGUAGE_GROUPS.map(({ id, name }) => {
		return { id, name }
	}),
]

export const SUPPORTED_CODE_BLOCK_LANGUAGES =
	SHIKI_BUNDLED_LANGUAGE_GROUPS.reduce<
		NonNullable<CodeBlockOptions['supportedLanguages']>
	>(
		(languages, language) => {
			const aliases = 'aliases' in language ? language.aliases : undefined

			languages[language.id] = aliases
				? { name: language.name, aliases: [...aliases] }
				: { name: language.name }

			return languages
		},
		{
			text: {
				name: 'Plain Text',
				aliases: ['txt', 'plaintext', 'plain'],
			},
		}
	)

type CodeBlockRenderProps = ReactCustomBlockRenderProps<
	typeof createCodeBlockConfig
>

type EditableBlockNoteEditor = CodeBlockRenderProps['editor'] & {
	document: Array<{ id: string }>
	replaceBlocks: (
		blocksToRemove: Array<string>,
		blocksToInsert: Array<{ type: 'paragraph' }>
	) => unknown
}

function getInlineText(content: unknown): string {
	if (typeof content === 'string') return content

	if (Array.isArray(content)) {
		return content.map((item) => getInlineText(item)).join('')
	}

	if (!content || typeof content !== 'object') return ''

	if ('text' in content && typeof content.text === 'string') {
		return content.text
	}

	if ('content' in content) {
		return getInlineText(content.content)
	}

	return ''
}

function getLanguageName(language: string) {
	return (
		getCanonicalLanguage(language)?.name ??
		CODE_BLOCK_LANGUAGES.find((item) => item.id === language)?.name ??
		language
	)
}

function getCanonicalLanguage(language: string) {
	if (['text', 'txt', 'plaintext', 'plain'].includes(language)) {
		return { id: 'text', name: 'Plain Text' }
	}

	return SHIKI_BUNDLED_LANGUAGE_GROUPS.find(
		(item) =>
			item.id === language ||
			('aliases' in item && item.aliases.some((alias) => alias === language))
	)
}

function CustomCodeBlock({ block, editor, contentRef }: CodeBlockRenderProps) {
	const [copied, setCopied] = useState(false)
	const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const language = block.props.language || DEFAULT_CODE_BLOCK_LANGUAGE
	const canonicalLanguage = getCanonicalLanguage(language)
	const selectedLanguage = canonicalLanguage?.id ?? language
	const canEdit = editor.isEditable

	const languageOptions = useMemo(() => {
		if (CODE_BLOCK_LANGUAGES.some((item) => item.id === selectedLanguage)) {
			return CODE_BLOCK_LANGUAGES
		}

		return [
			{ id: selectedLanguage, name: selectedLanguage },
			...CODE_BLOCK_LANGUAGES,
		]
	}, [selectedLanguage])

	const handleLanguageChange = useCallback(
		(nextLanguage: string | null) => {
			if (nextLanguage == null) return
			if (!editor.isEditable) return
			if (!editor.getBlock(block.id)) return

			editor.updateBlock(block.id, {
				props: {
					language: nextLanguage,
				},
			})
		},
		[block.id, editor]
	)

	const handleCopy = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(getInlineText(block.content))
			setCopied(true)
			toast.add({
				title: 'Copied',
				description: 'Code copied to clipboard',
			})

			if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
			copiedTimerRef.current = setTimeout(() => {
				setCopied(false)
				copiedTimerRef.current = null
			}, 1500)
		} catch {
			toast.add({
				type: 'error',
				title: 'Copy Failed',
				description: 'Failed to copy code to clipboard',
			})
		}
	}, [block.content])

	const handleDelete = useCallback(() => {
		if (!editor.isEditable) return
		if (!editor.getBlock(block.id)) return

		const editorWithParagraph = editor as EditableBlockNoteEditor

		if (editorWithParagraph.document.length > 1) {
			editor.removeBlocks([block.id])
			return
		}

		editorWithParagraph.replaceBlocks([block.id], [{ type: 'paragraph' }])
	}, [block.id, editor])

	useEffect(
		() => () => {
			if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
		},
		[]
	)

	const codeStyle = {
		'--code-block-font-family': CODE_BLOCK_FONT_FAMILY,
		'--code-block-font-size': CODE_BLOCK_FONT_SIZE,
		'--code-block-line-height': CODE_BLOCK_LINE_HEIGHT,
	} as CSSProperties

	return (
		<div className="my-5 w-full overflow-hidden rounded-none border bg-none text-primary">
			<div
				className="flex h-11 items-center justify-between gap-4 border-b px-4 select-none"
				contentEditable={false}
				role="toolbar"
				aria-label="Code block tools"
				// -1: focusable for the role without adding a tab stop. Real
				// keyboard access stays on the inner select/buttons, and mousedown
				// below keeps focus in the editor content.
				tabIndex={-1}
				// Chrome must not steal editor focus: after clicking the language
				// bar or its buttons, Ctrl+A and other shortcuts would target the
				// page (or the button) instead of the editor. mousedown default is
				// what moves focus, click still fires so controls keep working.
				onMouseDown={(event) => event.preventDefault()}
			>
				{canEdit ? (
					<Select value={selectedLanguage} onValueChange={handleLanguageChange}>
						<SelectTrigger
							aria-label="Code block language"
							size="sm"
							className="h-8 w-44 rounded-none border-none! bg-transparent! px-0 text-xs text-primary"
						>
							<SelectValue>
								<span className="font-medium text-primary">
									{getLanguageName(language)}
								</span>
							</SelectValue>
						</SelectTrigger>
						<SelectContent className="h-64 w-52 min-w-52">
							{languageOptions.map((item) => (
								<SelectItem key={item.id} value={item.id}>
									{item.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				) : (
					<span className="text-sm font-medium text-primary">
						{getLanguageName(language)}
					</span>
				)}

				<div className="flex shrink-0 items-center gap-1">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-8 gap-1.5 px-2 text-primary"
						contentEditable={false}
						onClick={handleCopy}
					>
						{copied ? (
							<IconCheck className="size-4" />
						) : (
							<IconCopy className="size-4" />
						)}
						{copied ? 'Copied' : 'Copy'}
					</Button>
					{!!canEdit && (
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							className="size-8 text-primary"
							contentEditable={false}
							aria-label="Delete code block"
							title="Delete code block"
							onClick={handleDelete}
						>
							<IconTrash className="size-4" />
						</Button>
					)}
				</div>
			</div>

			<pre className="m-0 overflow-x-auto px-5 py-4 text-primary">
				<code
					ref={contentRef}
					className="block min-w-full font-(family-name:--code-block-font-family) text-(length:--code-block-font-size) leading-(--code-block-line-height) whitespace-pre outline-none"
					data-language={language}
					style={codeStyle}
				/>
			</pre>
		</div>
	)
}

function CodeBlockExternalHTML({ block, contentRef }: CodeBlockRenderProps) {
	const language = block.props.language || DEFAULT_CODE_BLOCK_LANGUAGE

	return (
		<pre>
			<code
				ref={contentRef}
				className={`language-${language}`}
				data-language={language}
			/>
		</pre>
	)
}

export const BNCustomCodeBlock = createReactBlockSpec(
	createCodeBlockConfig,
	(options) => {
		const baseSpec = createCodeBlockSpec(options)

		return {
			...baseSpec.implementation,
			render: CustomCodeBlock,
			toExternalHTML: CodeBlockExternalHTML,
		}
	},
	(options) => createCodeBlockSpec(options).extensions ?? []
)
