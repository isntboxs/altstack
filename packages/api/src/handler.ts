import { SmartCoercionPlugin } from '@orpc/json-schema'
import { OpenAPIHandler } from '@orpc/openapi/fetch'
import { OpenAPIReferencePlugin } from '@orpc/openapi/plugins'
import { RPCHandler } from '@orpc/server/fetch'
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4'
import { withEvlog } from 'evlog/orpc'

import type { ORPCContext } from '@altstack/api/context'
import { createORPCContext } from '@altstack/api/context'
import { routers } from '@altstack/api/routers'

export const rpcHandler = withEvlog(new RPCHandler(routers))

export const openApiHandler = withEvlog(
	new OpenAPIHandler(routers, {
		plugins: [
			new SmartCoercionPlugin({
				schemaConverters: [new ZodToJsonSchemaConverter()],
			}),
			new OpenAPIReferencePlugin({
				schemaConverters: [new ZodToJsonSchemaConverter()],
				specGenerateOptions: {
					info: {
						title: 'Altstack RPC API Reference',
						version: '0.0.0',
						description: 'API Reference for Altstack',
					},
					commonSchemas: {
						UndefinedError: { error: 'UndefinedError' },
					},
					security: [{ apiKeyCookie: [] }],
					components: {
						securitySchemes: {
							apiKeyCookie: {
								type: 'apiKey',
								in: 'cookie',
								name: 'better-auth.session_token',
								description: 'Better Auth session cookie authentication',
							},
						},
					},
				},
			}),
		],
	})
)

export async function handle({ request }: { request: Request }) {
	const ctx = createORPCContext(request)

	const rpcResult = await rpcHandler.handle(request, {
		context: ctx as ORPCContext,
		prefix: '/api/rpc',
	})

	const openApiResult = await openApiHandler.handle(request, {
		context: ctx as ORPCContext,
		prefix: '/api/rpc/reference',
	})

	if (rpcResult.response) return rpcResult.response
	if (openApiResult.response) return openApiResult.response

	return new Response('Not Found', { status: 404 })
}
