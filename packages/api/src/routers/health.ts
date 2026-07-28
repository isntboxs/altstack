import { publicProcedure } from '@altstack/api/procedures'

export const healthRouter = publicProcedure.health.handler(({ context }) => {
	context.log.set({ route: 'health' })

	return {
		message: 'OK',
	}
})
