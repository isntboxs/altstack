import { initLogger } from 'evlog'
import { createAuthMiddleware } from 'evlog/better-auth'
import { createFsDrain } from 'evlog/fs'
import { evlog } from 'evlog/hono'
import type { EvlogVariables } from 'evlog/hono'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { runAdNotificationBatch } from '@altstack/api/ad-notifications'
import { createORPCContext } from '@altstack/api/context'
import { rpcHandler, openApiHandler } from '@altstack/api/handler'

import { auth } from '@altstack/auth/server'

import { db } from '@altstack/db'

import { env } from '@altstack/env/server'

initLogger({
	env: { service: 'altstack-server' },
})

const identifyUser = createAuthMiddleware(auth, {
	exclude: ['/api/auth/**'],
	maskEmail: true,
})

const app = new Hono<EvlogVariables>()

// Durable leases let multiple server instances share this delivery worker.
if (env.NODE_ENV !== 'test') {
	let delivering = false
	const deliver = async () => {
		if (delivering) return
		delivering = true
		try {
			await runAdNotificationBatch(db)
		} catch {
			process.stderr.write(
				'Ad notification worker failed; queued messages will retry.\n'
			)
		} finally {
			delivering = false
		}
	}
	setInterval(() => void deliver(), 30000).unref()
}

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
		exposeHeaders: [
			'RateLimit-Limit',
			'RateLimit-Remaining',
			'RateLimit-Reset',
			'Retry-After',
			'X-Retry-After',
		],
		credentials: true,
	})
)

app.all('/api/auth/*', async (c) => {
	const response = await auth.handler(c.req.raw)
	response.headers.set('Cache-Control', 'private, no-store')
	response.headers.set('Referrer-Policy', 'no-referrer')
	return response
})

// Private bookmark state and report contacts must never enter shared caches.
app.use('/api/*', async (c, next) => {
	if (
		/^\/api\/rpc\/(?:adBilling|admin\/adBilling)(?:\/|$)/.test(c.req.path) ||
		/^\/api\/(?:rpc\/(?:bookmark|ownership|admin\/(?:report|user))(?:\/|$)|reference\/(?:bookmarks|managed-projects|project-claims|projects\/[^/]+\/claim|admin\/(?:reports|users))(?:\/|$))/.test(
			c.req.path
		)
	) {
		c.header('Cache-Control', 'private, no-store')
		c.header('Referrer-Policy', 'no-referrer')
	}
	await next()
})

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

app.on('QUERY', '/', (c) => c.text('Altstack server is running!'))

export default {
	port: env.PORT,
	fetch: app.fetch,
}
