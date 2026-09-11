import { useLocation } from '@tanstack/react-router'
import { initLog, log } from 'evlog/client'
import { useEffect } from 'react'

export function LogProvider({ children }: { children: React.ReactNode }) {
	const pathname = useLocation({ select: (location) => location.pathname })

	useEffect(() => {
		initLog({ service: 'altstack-web/client' })
		log.info({ action: 'app_init', path: pathname })
	}, [pathname])

	return <>{children}</>
}
