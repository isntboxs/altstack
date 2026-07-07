import { Elysia } from 'elysia'
import { node } from '@elysia/node'

new Elysia({ adapter: node() })
	.get('/', () => 'Hello Elysia')
	.listen(3000, ({ hostname, port }) => {
		console.debug(`🦊 Elysia is running at ${hostname}:${port}`)
	})
