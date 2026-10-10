import { EvlogHandlerPlugin } from '@orpc/evlog'
import { SmartCoercionHandlerPlugin } from '@orpc/json-schema'
import {
	COMMON_ERROR_STATUS_MAP,
	getOpenAPIMeta,
	OpenAPIGenerator,
} from '@orpc/openapi'
import { OpenAPIHandler } from '@orpc/openapi/fetch'
import { OpenAPIReferenceHandlerPlugin } from '@orpc/openapi/plugins'
import { RateLimitHandlerPlugin } from '@orpc/ratelimit'
import { RPCHandler } from '@orpc/server/fetch'
import { RPC_DEFAULT_ALLOW_METHODS } from '@orpc/server/standard'
import { ZodToJsonSchemaConverter } from '@orpc/zod'

import { routers } from '@altstack/api/routers'

import { env } from '@altstack/env/server'

export const rpcHandler = new RPCHandler(routers, {
	allowMethods: ['QUERY', ...RPC_DEFAULT_ALLOW_METHODS],
	plugins: [
		new RateLimitHandlerPlugin(),
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
	// Expose only explicitly mapped REST procedures. RPC-only compatibility
	// procedures must not acquire fallback paths in the matcher or reference.
	filter: (procedure) => getOpenAPIMeta(procedure)?.path !== undefined,
	plugins: [
		new RateLimitHandlerPlugin(),
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
					filter: (procedure) => getOpenAPIMeta(procedure)?.path !== undefined,
					base: {
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
