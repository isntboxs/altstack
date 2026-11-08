import type { ComponentProps } from 'react'

import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from '@altstack/ui/components/avatar'

import { useGenerateAvatar } from '#/hooks/use-generate-avatar'

export const UserAvatar = ({
	image,
	name,
	size = 'sm',
}: {
	image?: string | null
	name: string
	size?: ComponentProps<typeof Avatar>['size']
}) => {
	const generatedAvatar = useGenerateAvatar({ seed: name })

	return (
		<Avatar
			size={size}
			className="rounded-[min(var(--radius-md),12px)] after:rounded-[min(var(--radius-md),12px)]"
		>
			<AvatarImage
				src={image?.trim() ? image : generatedAvatar}
				alt={name}
				className="rounded-[min(var(--radius-md),12px)]"
			/>
			<AvatarFallback className="rounded-[min(var(--radius-md),12px)]">
				{name.slice(0, 2).toUpperCase()}
			</AvatarFallback>
		</Avatar>
	)
}
