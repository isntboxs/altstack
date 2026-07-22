import { Elysia } from 'elysia'

import { env } from '@altstack/env/server'

const PORT = env.PORT

const app = new Elysia().get('/', () => 'Hello Elysia').listen(PORT)

console.debug(
	`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
)
