import { getLogger } from '@orpc/evlog'

import { publicProcedure } from '@altstack/api/procedures'

export const healthRouter = publicProcedure.health.handler(({ context }) => {
	const logger = getLogger(context)

	logger?.set({ route: 'health' })

	return {
		message: 'OK',
	}
})
