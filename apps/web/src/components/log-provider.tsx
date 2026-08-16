import { initLog } from 'evlog/client'
import { useEffect } from 'react'

export function LogProvider({ children }: { children: React.ReactNode }) {
	useEffect(() => {
		initLog({
			service: 'altstack-web/client',
			transport: {
				enabled: true,
				endpoint: '/api/_evlog/ingest',
			},
		})
	}, [])

	return <>{children}</>
}
