import { IconCheck, IconCopy } from '@tabler/icons-react'
import { Fragment, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

import { Button } from '@altstack/ui/components/button'

import type {
	CodeTokenStyle,
	PreparedCodeBlock,
} from '#/features/public-content/model'

function themeStyles(light: CodeTokenStyle, dark: CodeTokenStyle) {
	const style: CSSProperties & Record<`--${string}`, string | undefined> = {}
	for (const [theme, value] of Object.entries({ light, dark })) {
		const fontStyle = value.fontStyle ?? 0
		style[`--code-${theme}-color`] = value.color
		style[`--code-${theme}-bg`] = value.bgColor
		style[`--code-${theme}-style`] = fontStyle & 1 ? 'italic' : 'normal'
		style[`--code-${theme}-weight`] = fontStyle & 2 ? '700' : '400'
		style[`--code-${theme}-decoration`] =
			[fontStyle & 4 ? 'underline' : '', fontStyle & 8 ? 'line-through' : '']
				.filter(Boolean)
				.join(' ') || 'none'
	}
	return style
}

export function PublicCodeBlock({ block }: { block: PreparedCodeBlock }) {
	const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>(
		'idle'
	)
	const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined
	)
	useEffect(() => () => clearTimeout(resetTimer.current), [])

	async function copyCode() {
		clearTimeout(resetTimer.current)
		try {
			await navigator.clipboard.writeText(block.code)
			setCopyState('copied')
		} catch {
			setCopyState('failed')
		}
		resetTimer.current = setTimeout(() => setCopyState('idle'), 2500)
	}

	return (
		<div
			className="not-prose my-6 overflow-hidden rounded-lg border border-border"
			data-code-block
		>
			<div className="flex items-center justify-between gap-3 border-b border-border bg-muted px-3 py-2">
				<span className="truncate font-mono text-xs text-muted-foreground">
					{block.language}
				</span>
				<Button
					type="button"
					variant="ghost"
					size="xs"
					onClick={copyCode}
					aria-label="Copy code"
				>
					{copyState === 'copied' ? (
						<IconCheck data-icon="inline-start" />
					) : (
						<IconCopy data-icon="inline-start" />
					)}
					{copyState === 'copied'
						? 'Copied'
						: copyState === 'failed'
							? 'Copy failed'
							: 'Copy'}
				</Button>
				<output className="sr-only">
					{copyState === 'copied'
						? 'Code copied to clipboard.'
						: copyState === 'failed'
							? 'Unable to copy code. Select and copy it manually.'
							: ''}
				</output>
			</div>
			<pre
				className="public-code m-0 overflow-x-auto p-4 text-sm leading-6"
				style={
					block.colors
						? themeStyles(block.colors.light, block.colors.dark)
						: undefined
				}
				// Keyboard users need to scroll long lines without selecting text.
				// oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
				tabIndex={0}
				aria-label={`${block.language} code`}
			>
				<code>
					{block.tokens
						? block.tokens.map((line, lineIndex) => (
								<Fragment key={lineIndex}>
									{lineIndex > 0 ? '\n' : null}
									{line.map((token, tokenIndex) => (
										<span
											key={tokenIndex}
											className="public-code-token"
											style={themeStyles(token.light, token.dark)}
										>
											{token.content}
										</span>
									))}
								</Fragment>
							))
						: block.code}
				</code>
			</pre>
		</div>
	)
}
