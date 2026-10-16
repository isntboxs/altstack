import { cn } from 'cn'
import { useState } from 'react'

import { resolveFileUrl } from '#/utils/storage'

export function ProjectLogo({
	src,
	name,
	className,
}: {
	src: string | null | undefined
	name: string
	className?: string
}) {
	const url = resolveFileUrl(src)
	return <LogoImage key={url} src={url} name={name} className={className} />
}

function LogoImage({
	src,
	name,
	className,
}: {
	src: string | null
	name: string
	className?: string
}) {
	const [failed, setFailed] = useState(false)
	const initials =
		name
			.trim()
			.split(/\s+/)
			.slice(0, 2)
			.map((word) => Array.from(word)[0])
			.join('')
			.toUpperCase() || 'A'
	return (
		<span
			aria-hidden="true"
			className={cn(
				'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xs bg-muted text-sm font-semibold text-muted-foreground',
				className
			)}
		>
			{src && !failed ? (
				<img
					src={src}
					alt=""
					className="size-full object-contain"
					ref={(element) => {
						if (element?.complete && element.naturalWidth === 0) setFailed(true)
					}}
					onError={() => setFailed(true)}
				/>
			) : (
				initials
			)}
		</span>
	)
}

export function ProjectScreenshot({
	src,
	name,
	websiteUrl,
}: {
	src: string | null | undefined
	name: string
	websiteUrl: string | null
}) {
	const url = resolveFileUrl(src)
	return (
		<ScreenshotImage key={url} src={url} name={name} websiteUrl={websiteUrl} />
	)
}

function ScreenshotImage({
	src,
	name,
	websiteUrl,
}: {
	src: string | null
	name: string
	websiteUrl: string | null
}) {
	const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading')
	if (!src || state === 'failed') {
		return (
			<output className="block rounded-lg border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
				{state === 'failed'
					? 'Screenshot unavailable'
					: 'No screenshot available.'}
			</output>
		)
	}

	const media = (
		<div
			className="relative aspect-video overflow-hidden rounded-lg bg-muted"
			aria-busy={state === 'loading'}
		>
			{state === 'loading' && (
				<output className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
					Loading screenshot…
				</output>
			)}
			<img
				src={src}
				alt={`Screenshot of ${name}`}
				className="relative aspect-video w-full object-cover"
				ref={(element) => {
					if (element?.complete) {
						setState(element.naturalWidth > 0 ? 'loaded' : 'failed')
					}
				}}
				onLoad={() => setState('loaded')}
				onError={() => setState('failed')}
			/>
		</div>
	)
	return websiteUrl ? (
		<a
			href={websiteUrl}
			target="_blank"
			rel="noopener noreferrer"
			aria-label={`Visit ${name} website (opens in a new tab)`}
			className="block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
		>
			{media}
		</a>
	) : (
		media
	)
}
