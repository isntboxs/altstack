import { initLogger } from 'evlog'
import { createAuthMiddleware } from 'evlog/better-auth'
import { createFsDrain } from 'evlog/fs'
import { evlog } from 'evlog/hono'
import type { EvlogVariables } from 'evlog/hono'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { createORPCContext } from '@altstack/api/context'
import { rpcHandler, openApiHandler } from '@altstack/api/handler'

import { auth } from '@altstack/auth/server'

import { env } from '@altstack/env/server'

initLogger({
	env: { service: 'altstack-server' },
})

const identifyUser = createAuthMiddleware(auth, {
	exclude: ['/api/auth/**'],
	maskEmail: true,
})

const app = new Hono<EvlogVariables>()

app.use(
	evlog({
		drain: env.NODE_ENV === 'production' ? undefined : createFsDrain(),
	})
)

app.use('*', async (c, next) => {
	await identifyUser(c.get('log'), c.req.raw.headers, c.req.path)
	await next()
})

app.use(
	'*',
	cors({
		origin: env.CORS_ORIGINS,
		allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'QUERY', 'OPTIONS'],
		allowHeaders: ['Content-Type', 'Authorization'],
		credentials: true,
	})
)

app.all('/api/auth/*', (c) => auth.handler(c.req.raw))

app.use('/api/rpc*', async (c, next) => {
	const context = await createORPCContext({ headers: c.req.raw.headers })

	const { matched, response } = await rpcHandler.handle(c.req.raw, {
		context,
		prefix: '/api/rpc',
	})

	if (matched) return c.newResponse(response.body, response)

	await next()
})

app.all('/api/reference*', async (c, next) => {
	const context = await createORPCContext({ headers: c.req.raw.headers })
	const { matched, response } = await openApiHandler.handle(c.req.raw, {
		context,
		prefix: '/api/reference',
	})

	if (matched) return c.newResponse(response.body, response)

	await next()
})

app.get('/', (c) => c.text('Altstack server is running!'))

export default {
	port: env.PORT,
	fetch: app.fetch,
}
