import { cn } from 'cn'
import React from 'react'

function AspectRatio({
	ratio,
	className,
	style,
	...props
}: React.ComponentProps<'div'> & { ratio: number }) {
	return (
		<div
			data-slot="aspect-ratio"
			style={
				{
					...style,
					'--ratio': ratio,
				} as React.CSSProperties
			}
			className={cn('relative aspect-(--ratio)', className)}
			{...props}
		/>
	)
}

export { AspectRatio }
