import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from '@altstack/ui/components/avatar'

export const UserAvatar = ({
	image,
	name,
}: {
	image?: string | null
	name: string
}) => {
	if (!image) {
		return (
			<Avatar
				size="sm"
				className="rounded-[min(var(--radius-md),12px)] after:rounded-[min(var(--radius-md),12px)]"
			>
				<AvatarFallback className="rounded-[min(var(--radius-md),12px)]">
					{name.slice(0, 2).toUpperCase()}
				</AvatarFallback>
			</Avatar>
		)
	}

	return (
		<Avatar
			size="sm"
			className="rounded-[min(var(--radius-md),12px)] after:rounded-[min(var(--radius-md),12px)]"
		>
			<AvatarImage
				src={image}
				alt={name}
				className="rounded-[min(var(--radius-md),12px)]"
			/>
			<AvatarFallback className="rounded-[min(var(--radius-md),12px)]">
				{name.slice(0, 2).toUpperCase()}
			</AvatarFallback>
		</Avatar>
	)
}
