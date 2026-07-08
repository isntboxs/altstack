import { cors } from '@elysia/cors'
import { node } from '@elysia/node'
import { Elysia } from 'elysia'
import { initLogger } from 'evlog'
import { evlog } from 'evlog/elysia'

import { createORPCContext } from '@cort/api/context'
import type { ORPCContext } from '@cort/api/context'
import { rpcHandler } from '@cort/api/handler'

import { env } from '@cort/env/server'

const PORT = env.PORT

initLogger({
	env: { service: 'cort-server' },
})

new Elysia({ adapter: node() })
	.use(evlog())
	.use(
		cors({
			origin: env.CORS_ORIGINS,
			methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
			credentials: true,
			allowedHeaders: ['Content-Type', 'Authorization'],
		})
	)
	.all(
		'/api*',
		async (context) => {
			const { matched, response } = await rpcHandler.handle(context.request, {
				prefix: '/api',
				context: createORPCContext({ context }) as ORPCContext,
			})

			return matched ? response : new Response('Not Found', { status: 404 })
		},
		{ parse: 'none' }
	)
	.get('/', () => 'Cort Server is running!')
	.listen(PORT, ({ hostname, port }) => {
		console.debug(`🦊 Elysia is running at ${hostname}:${port}`)
	})
