import { createFileRoute } from '@tanstack/react-router'

import { handle } from '@altstack/api/handler'

export const Route = createFileRoute('/api/rpc/$')({
	server: {
		handlers: {
			ANY: handle,
		},
	},
})
