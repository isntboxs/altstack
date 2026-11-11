import { useState } from 'react'

export function ContentImage({
	src,
	alt = '',
	title,
}: {
	src?: string
	alt?: string
	title?: string
}) {
	const [failedSource, setFailedSource] = useState<string>()
	if (!src || failedSource === src) {
		return (
			<span className="text-muted-foreground">
				{alt ? `Image unavailable: ${alt}` : 'Image unavailable'}
			</span>
		)
	}
	return (
		<img
			src={src}
			alt={alt}
			title={title}
			loading="lazy"
			decoding="async"
			className="h-auto max-w-full object-contain"
			onError={() => setFailedSource(src)}
		/>
	)
}
