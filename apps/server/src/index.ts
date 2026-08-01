import { cors } from '@elysiajs/cors'
import { Elysia } from 'elysia'
import { initLogger } from 'evlog'
import { createAuthMiddleware } from 'evlog/better-auth'
import { evlog } from 'evlog/elysia'
import { createFsDrain } from 'evlog/fs'

import { handleOpenApi, handleRPC } from '@altstack/api/handler'

import { auth } from '@altstack/auth/server'

import { env } from '@altstack/env/server'

initLogger({
	env: { service: 'altstack-server' },
})

const identifyUser = createAuthMiddleware(auth, {
	exclude: ['/api/auth/**'],
	maskEmail: true,
})

const app = new Elysia()
	.use(
		evlog({
			drain: env.NODE_ENV === 'production' ? undefined : createFsDrain(),
		})
	)
	.derive(async ({ request, log }) => {
		await identifyUser(log, request.headers, new URL(request.url).pathname)
		return {}
	})
	.use(
		cors({
			origin: env.CORS_ORIGINS,
			methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
			allowedHeaders: ['Content-Type', 'Authorization'],
			credentials: true,
		})
	)
	.all('/api/auth/*', async (context) => {
		const { request, status } = context
		if (['POST', 'GET'].includes(request.method)) {
			return auth.handler(request)
		}
		return status(405)
	})
	.all('/api/rpc*', async (context) => await handleRPC(context))
	.all('/api/reference*', async (context) => await handleOpenApi(context))
	.get('/', () => 'Altstack server is running!')
	.listen(env.PORT)

console.debug(
	`🦊 Altstack server is running at http://${app.server?.hostname}:${app.server?.port}`
)
