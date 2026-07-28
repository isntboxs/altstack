import { createFileRoute } from '@tanstack/react-router'

import { handleRPC } from '@altstack/api/handler'

export const Route = createFileRoute('/api/rpc/$')({
	server: {
		handlers: {
			ANY: handleRPC,
		},
	},
})
