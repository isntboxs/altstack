import { EvlogHandlerPlugin } from '@orpc/evlog'
import { SmartCoercionHandlerPlugin } from '@orpc/json-schema'
import { COMMON_ERROR_STATUS_MAP, OpenAPIGenerator } from '@orpc/openapi'
import { OpenAPIHandler } from '@orpc/openapi/fetch'
import { OpenAPIReferenceHandlerPlugin } from '@orpc/openapi/plugins'
import { RPCHandler } from '@orpc/server/fetch'
import { GetMethodCsrfProtectionHandlerPlugin } from '@orpc/server/plugins'
import { RPC_DEFAULT_ALLOW_METHODS } from '@orpc/server/standard'
import { ZodToJsonSchemaConverter } from '@orpc/zod'

import { routers } from '@altstack/api/routers'

import { env } from '@altstack/env/server'

export const rpcHandler = new RPCHandler(routers, {
	allowMethods: ['GET', 'QUERY', ...RPC_DEFAULT_ALLOW_METHODS],
	plugins: [
		new GetMethodCsrfProtectionHandlerPlugin(),

		new EvlogHandlerPlugin({
			drain: undefined, // <- custom Evlog drain
			plugins: [], // <- additional Evlog plugins
			logAbort: true, // <- log when requests are aborted
		}),
	],
})

const generator = new OpenAPIGenerator({
	converters: [new ZodToJsonSchemaConverter()],
})

export const openApiHandler = new OpenAPIHandler(routers, {
	plugins: [
		new EvlogHandlerPlugin({
			drain: undefined, // <- custom Evlog drain
			plugins: [], // <- additional Evlog plugins
			logAbort: true, // <- log when requests are aborted
		}),

		new SmartCoercionHandlerPlugin({
			converters: [new ZodToJsonSchemaConverter()],
		}),

		new OpenAPIReferenceHandlerPlugin({
			provider: 'scalar',
			spec: () =>
				generator.generate(routers, {
					base: {
						openapi: '3.2.0',
						info: {
							title: 'Altstack API',
							version: '0.0.0',
							description: 'API Reference for Altstack',
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
						servers: [{ url: `${env.BETTER_AUTH_URL}/api/reference` }],
					},
				}),
		}),
	],

	customErrorResponseBodyEncoder: (error) => {
		return {
			...error.toJSON(),
			status:
				COMMON_ERROR_STATUS_MAP[
					error.code as keyof typeof COMMON_ERROR_STATUS_MAP
				],
		}
	},
})
