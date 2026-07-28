import { createFileRoute } from '@tanstack/react-router'

import { handleOpenApi } from '@altstack/api/handler'

export const Route = createFileRoute('/api/rpc/reference/$')({
	server: {
		handlers: {
			ANY: handleOpenApi,
		},
	},
})
