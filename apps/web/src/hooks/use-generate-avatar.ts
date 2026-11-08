import { Style, Avatar } from '@dicebear/core'
import initialFace from '@dicebear/styles/initial-face.json' with { type: 'json' }
import notionistsNeutral from '@dicebear/styles/notionists-neutral.json' with { type: 'json' }
import { useMemo } from 'react'

const avatarStyles = {
	initialFace: new Style(initialFace),
	notionistsNeutral: new Style(notionistsNeutral),
}

export const useGenerateAvatar = ({
	seed,
	style = 'notionistsNeutral',
}: {
	seed: string
	style?: 'initialFace' | 'notionistsNeutral'
}) =>
	useMemo(
		() => new Avatar(avatarStyles[style], { seed }).toDataUri(),
		[seed, style]
	)
