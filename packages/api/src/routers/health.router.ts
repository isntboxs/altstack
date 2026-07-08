import { publicProcedure } from '@cort/api/procedure'

export const healthRouter = publicProcedure.health.handler(({ context }) => {
	context.log.set({ route: 'health' })

	return {
		message: 'OK',
	}
})
