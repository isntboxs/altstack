import { Elysia } from 'elysia'
import { node } from '@elysia/node'
import { env } from '@cort/env/server'

const PORT = env.PORT

new Elysia({ adapter: node() })
	.get('/', () => 'Hello Elysia')
	.listen(PORT, ({ hostname, port }) => {
		console.debug(`🦊 Elysia is running at ${hostname}:${port}`)
	})
