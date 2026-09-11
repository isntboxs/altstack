import { clearIdentity, setIdentity } from 'evlog/client'
import { useEffect } from 'react'

import { authClient } from '@altstack/auth/client'

export const useAuthIdentity = () => {
	const { data: auth } = authClient.useSession()
	const userId = auth?.user.id
	const userName = auth?.user.name

	useEffect(() => {
		if (userId) {
			setIdentity({ userId, userName })
		} else {
			clearIdentity()
		}
	}, [userId, userName])
}
