import { IconCheck, IconCopy } from '@tabler/icons-react'
import { useId, useRef, useState } from 'react'

import { Button } from '@altstack/ui/components/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@altstack/ui/components/dialog'
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from '@altstack/ui/components/field'
import { Input } from '@altstack/ui/components/input'
import { Textarea } from '@altstack/ui/components/textarea'
import {
	ToggleGroup,
	ToggleGroupItem,
} from '@altstack/ui/components/toggle-group'

import {
	badgeDefaults,
	badgeDimension,
	badgeLimits,
	badgeSnippet,
	badgeUrl,
} from '#/features/project/embed/badge'
import type { BadgeTheme } from '#/features/project/embed/badge'

function BadgePreview({
	src,
	name,
	width,
	height,
}: {
	src: string
	name: string
	width: number
	height: number
}) {
	const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(
		'loading'
	)
	return (
		<>
			{status !== 'error' && (
				<img
					src={src}
					alt={`${name} badge`}
					width={width}
					height={height}
					className="block h-auto max-h-32 max-w-full object-contain"
					style={{ aspectRatio: `${width} / ${height}` }}
					onLoad={() => setStatus('loaded')}
					onError={() => setStatus('error')}
				/>
			)}
			<output className={status === 'loaded' ? 'sr-only' : undefined}>
				{status === 'loading'
					? 'Loading badge…'
					: status === 'error'
						? 'Badge unavailable. Try reopening the preview.'
						: 'Badge loaded.'}
			</output>
		</>
	)
}

export function ProjectEmbedDialog({
	slug,
	name,
	open,
	onOpenChange,
	finalFocus,
}: {
	slug: string
	name: string
	open: boolean
	onOpenChange: (open: boolean) => void
	finalFocus: () => HTMLElement | null
}) {
	const id = useId()
	const [theme, setTheme] = useState<BadgeTheme>(badgeDefaults.theme)
	const [widthText, setWidthText] = useState(String(badgeDefaults.width))
	const [heightText, setHeightText] = useState(String(badgeDefaults.height))
	const [copy, setCopy] = useState<'idle' | 'pending' | 'success' | 'error'>(
		'idle'
	)
	const copyVersion = useRef(0)
	const codeRef = useRef<HTMLTextAreaElement>(null)
	const width = badgeDimension(widthText, 'width')
	const height = badgeDimension(heightText, 'height')
	const options = width && height ? { theme, width, height } : null
	const snippet = options ? badgeSnippet(slug, name, options) : ''
	function edited() {
		copyVersion.current++
		setCopy('idle')
	}
	async function copyCode() {
		const version = ++copyVersion.current
		setCopy('pending')
		try {
			await navigator.clipboard.writeText(snippet)
			if (version === copyVersion.current) setCopy('success')
		} catch {
			if (version !== copyVersion.current) return
			setCopy('error')
			codeRef.current?.focus({ preventScroll: true })
			codeRef.current?.select()
		}
	}
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="max-h-[calc(100dvh-2rem)] min-w-0 overflow-y-auto sm:max-w-md"
				finalFocus={finalFocus}
			>
				<DialogHeader className="min-w-0 pr-6">
					<DialogTitle className="wrap-anywhere">
						Embed the {name} badge
					</DialogTitle>
					<DialogDescription>
						Add a link to this AltStack listing on your website or
						documentation.
					</DialogDescription>
				</DialogHeader>
				<FieldGroup className="grid grid-cols-2 gap-3 min-[400px]:grid-cols-[1.4fr_1fr_1fr]">
					<Field className="col-span-2 min-w-0 min-[400px]:col-span-1">
						<FieldLabel id={`${id}-theme`}>Theme</FieldLabel>
						<ToggleGroup
							aria-labelledby={`${id}-theme`}
							variant="outline"
							spacing={0}
							value={[theme]}
							onValueChange={(values) => {
								const next = values[0]
								if (next === 'dark' || next === 'light') {
									setTheme(next)
									edited()
								}
							}}
						>
							<ToggleGroupItem value="dark">Dark</ToggleGroupItem>
							<ToggleGroupItem value="light">Light</ToggleGroupItem>
						</ToggleGroup>
					</Field>
					{(['width', 'height'] as const).map((dimension) => {
						const valid = dimension === 'width' ? width : height
						const label = dimension === 'width' ? 'Width' : 'Height'
						return (
							<Field
								key={dimension}
								className="min-w-0"
								data-invalid={!valid || undefined}
							>
								<FieldLabel htmlFor={`${id}-${dimension}`}>{label}</FieldLabel>
								<Input
									id={`${id}-${dimension}`}
									type="text"
									inputMode="numeric"
									value={dimension === 'width' ? widthText : heightText}
									aria-invalid={!valid}
									aria-describedby={`${id}-${dimension}-help`}
									onChange={(event) => {
										;(dimension === 'width' ? setWidthText : setHeightText)(
											event.target.value
										)
										edited()
									}}
								/>
								{valid ? (
									<FieldDescription id={`${id}-${dimension}-help`}>
										{badgeLimits[dimension].min}–{badgeLimits[dimension].max} px
									</FieldDescription>
								) : (
									<FieldError id={`${id}-${dimension}-help`}>
										Use a whole number from {badgeLimits[dimension].min} to{' '}
										{badgeLimits[dimension].max}.
									</FieldError>
								)}
							</Field>
						)
					})}
				</FieldGroup>
				<FieldGroup className="gap-4">
					<Field>
						<FieldLabel id={`${id}-preview`}>Preview</FieldLabel>
						<div
							aria-labelledby={`${id}-preview`}
							className="flex min-h-24 min-w-0 flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border p-4 text-xs"
							style={{
								backgroundColor: theme === 'dark' ? '#080808' : '#f5f5f5',
								color: theme === 'dark' ? '#b8b8b8' : '#525252',
							}}
						>
							{options ? (
								<BadgePreview
									key={badgeUrl(slug, options)}
									src={badgeUrl(slug, options)}
									name={name}
									width={options.width}
									height={options.height}
								/>
							) : (
								<output>Enter valid dimensions to preview the badge.</output>
							)}
						</div>
						<FieldDescription>
							{options
								? `${options.width} × ${options.height} px · Preview scales to fit; the artwork keeps its proportions.`
								: 'Preview and code update when both dimensions are valid.'}
						</FieldDescription>
					</Field>
					<Field>
						<div className="flex items-center justify-between gap-2">
							<FieldLabel htmlFor={`${id}-code`}>Embed code</FieldLabel>
							<Button
								variant="outline"
								size="sm"
								disabled={!snippet || copy === 'pending'}
								onClick={copyCode}
							>
								{copy === 'success' ? (
									<IconCheck data-icon="inline-start" />
								) : (
									<IconCopy data-icon="inline-start" />
								)}
								{copy === 'success'
									? 'Copied'
									: copy === 'pending'
										? 'Copying…'
										: 'Copy'}
							</Button>
						</div>
						<Textarea
							ref={codeRef}
							id={`${id}-code`}
							readOnly
							value={snippet}
							placeholder="Enter valid dimensions to generate embed code."
							rows={4}
							className="field-sizing-fixed h-28 min-h-20 resize-none font-mono text-xs"
							aria-describedby={`${id}-copy-status`}
						/>
						<output
							id={`${id}-copy-status`}
							className="text-xs text-muted-foreground"
						>
							{copy === 'error'
								? 'Copy failed. The code is selected; copy it manually with Ctrl+C or ⌘C.'
								: copy === 'success'
									? 'Embed code copied to clipboard.'
									: 'Copy this HTML into your website or documentation.'}
						</output>
					</Field>
				</FieldGroup>
			</DialogContent>
		</Dialog>
	)
}
