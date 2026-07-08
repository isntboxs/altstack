import { SmartCoercionPlugin } from '@orpc/json-schema'
import { OpenAPIHandler } from '@orpc/openapi/fetch'
import { OpenAPIReferencePlugin } from '@orpc/openapi/plugins'
import { RPCHandler } from '@orpc/server/fetch'
import { ResponseHeadersPlugin } from '@orpc/server/plugins'
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4'
import { withEvlog } from 'evlog/orpc'

import { orpcRouters } from '@cort/api/routers'

export const rpcHandler = withEvlog(new RPCHandler(orpcRouters))

export const openApiHandler = withEvlog(
	new OpenAPIHandler(orpcRouters, {
		plugins: [
			new ResponseHeadersPlugin(),
			new SmartCoercionPlugin({
				schemaConverters: [new ZodToJsonSchemaConverter()],
			}),
			new OpenAPIReferencePlugin({
				schemaConverters: [new ZodToJsonSchemaConverter()],
				specGenerateOptions: {
					info: {
						title: 'Coret RPC API Reference',
						version: '1.0.0',
						description: 'API Reference for Coret',
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
