import {
	createORPCClient,
	createORPCErrorFromJson,
	ORPCError,
} from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import type { FetchLinkTransportOptions } from '@orpc/client/fetch'
import type { ContractRouterClient } from '@orpc/contract'
import { OpenAPILink } from '@orpc/openapi/fetch'
import { createRouterClient } from '@orpc/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { z } from 'zod'

import type { ORPCContext } from '@altstack/api/context'
import { contracts } from '@altstack/api/contracts'
import { fetchPublicGithubRepository } from '@altstack/api/github'
import { openApiHandler, rpcHandler } from '@altstack/api/handler'
import { submissionRouter } from '@altstack/api/routers/submission'
import { submissionRedis } from '@altstack/api/submission-rate-limit'

vi.mock('@altstack/env/server', () => {
	return {
		env: {
			NODE_ENV: 'test',
			UPSTASH_REDIS_REST_URL: 'https://redis.test.invalid',
			UPSTASH_REDIS_REST_TOKEN: 'fake-test-only-token',
			BETTER_AUTH_URL: 'http://localhost:3009',
			S3_REGION: 'auto',
			S3_ENDPOINT: 'https://storage.test.invalid',
			S3_ACCESS_KEY_ID: 'fake-test-only-id',
			S3_SECRET_ACCESS_KEY: 'fake-test-only-secret',
		},
	}
})
vi.mock('@altstack/api/github', () => {
	return {
		fetchPublicGithubRepository: vi.fn(),
	}
})

const ID = '550e8400-e29b-41d4-a716-446655440000'
const input = { name: 'Example Tool', repositoryUrl: 'example/tool' }
let selectResults: Array<Array<Record<string, unknown>>>
let counters: Map<string, number>
const select = vi.fn(() => {
	return {
		from: () => {
			return {
				where: () => {
					const result = selectResults.shift() ?? []
					return Object.assign(Promise.resolve(result), {
						limit: () => Promise.resolve(result),
						orderBy: () => {
							return {
								limit: () => {
									return { offset: () => Promise.resolve(result) }
								},
							}
						},
					})
				},
			}
		},
	}
})
const transaction = vi.fn(async (work: (tx: unknown) => Promise<unknown>) =>
	work({
		select,
		execute: vi.fn().mockResolvedValue(undefined),
		insert: () => {
			return {
				values: () =>
					Object.assign(Promise.resolve(), {
						onConflictDoNothing: () => {
							return {
								returning: () => Promise.resolve([{ id: ID }]),
							}
						},
					}),
			}
		},
	})
)

function context(id: string | null = 'account-a', role = 'user'): ORPCContext {
	return {
		db: { select, transaction } as unknown as ORPCContext['db'],
		auth: id ? ({ user: { id, role } } as ORPCContext['auth']) : null,
	}
}
function client(id: string | null = 'account-a', role = 'user') {
	return createRouterClient(submissionRouter, { context: context(id, role) })
}

beforeEach(() => {
	vi.spyOn(Date, 'now').mockReturnValue(
		new Date('2026-10-10T12:00:00Z').getTime()
	)
	selectResults = []
	counters = new Map()
	select.mockClear()
	transaction.mockClear()
	vi.mocked(fetchPublicGithubRepository).mockReset().mockResolvedValue({
		canonicalUrl: 'https://github.com/example/tool',
		owner: 'example',
		repo: 'tool',
		stars: 0,
		forks: 0,
	})
	// Keep the real Upstash algorithm, adapter and oRPC middleware. Only Redis
	// storage is mocked; no HTTP request or credentials are used in these tests.
	vi.spyOn(submissionRedis, 'evalsha').mockImplementation((_sha, keys) => {
		const key = String(keys[0])
		const attempts = (counters.get(key) ?? 0) + 1
		counters.set(key, attempts)
		return Promise.resolve([5 - attempts, 5])
	})
})
afterEach(() => {
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
})

describe('submission quota middleware', () => {
	it('allows five attempts and denies the sixth before database/GitHub', async () => {
		for (let attempt = 0; attempt < 5; attempt++) {
			await expect(client().create(input)).resolves.toEqual({
				id: ID,
				status: 'draft',
			})
		}
		select.mockClear()
		vi.mocked(fetchPublicGithubRepository).mockClear()
		await expect(client().create(input)).rejects.toMatchObject({
			code: 'TOO_MANY_REQUESTS',
			data: { limit: 5, remaining: 0 },
		})
		expect(select).not.toHaveBeenCalled()
		expect(fetchPublicGithubRepository).not.toHaveBeenCalled()
		expect(submissionRedis.evalsha).toHaveBeenCalledTimes(6)
		const firstCall = vi.mocked(submissionRedis.evalsha).mock.calls[0]
		expect(firstCall?.[2]).toEqual([5, Date.now(), 600_000, 1])
		expect(firstCall?.[1]).toHaveLength(2)
	})
	it('keys only by session user, with the same policy for admins', async () => {
		for (let attempt = 0; attempt < 5; attempt++) {
			await client('admin-a', 'admin').create(input)
		}
		await expect(
			client('admin-a', 'admin').create(input)
		).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' })
		await expect(
			client('admin-b', 'admin').create(input)
		).resolves.toHaveProperty('id', ID)
		await expect(client().create(input)).resolves.toHaveProperty('id', ID)
		const keys = [...counters.keys()]
		expect(keys).toHaveLength(3)
		expect(keys).toEqual(
			expect.arrayContaining([
				expect.stringContaining(
					'altstack:test:submission:create:user:admin-a:'
				),
				expect.stringContaining(
					'altstack:test:submission:create:user:admin-b:'
				),
				expect.stringContaining(
					'altstack:test:submission:create:user:account-a:'
				),
			])
		)
	})
	it('auth and validation run before Redis, and other endpoints are unrestricted', async () => {
		await expect(client(null).create(input)).rejects.toMatchObject({
			code: 'UNAUTHORIZED',
		})
		await expect(
			client(null).create({ ...input, name: '' })
		).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
		await expect(
			client().create({ ...input, name: 'x' })
		).rejects.toMatchObject({ code: 'BAD_REQUEST' })
		await expect(
			client().create({ ...input, repositoryUrl: 'invalid' })
		).rejects.toMatchObject({ code: 'BAD_REQUEST' })
		expect(submissionRedis.evalsha).not.toHaveBeenCalled()
		expect(select).not.toHaveBeenCalled()
		await expect(client().list({ query: {} })).resolves.toHaveProperty(
			'submissions'
		)
		expect(submissionRedis.evalsha).not.toHaveBeenCalled()
	})
	it.each(['duplicate', 'capacity', 'github', 'storage'] as const)(
		'consumes accepted attempts even on later %s failures',
		async (failure) => {
			const codes = {
				duplicate: 'CONFLICT',
				capacity: 'TOO_MANY_REQUESTS',
				github: 'TOO_MANY_REQUESTS',
				storage: 'INTERNAL_SERVER_ERROR',
			}
			for (let attempt = 0; attempt < 5; attempt++) {
				if (failure === 'duplicate') selectResults = [[{ id: ID }]]
				if (failure === 'capacity') selectResults = [[], [{ count: 10 }]]
				if (failure === 'github') {
					vi.mocked(fetchPublicGithubRepository).mockRejectedValueOnce(
						new ORPCError('TOO_MANY_REQUESTS', { message: 'GitHub rate limit' })
					)
				}
				if (failure === 'storage') {
					transaction.mockRejectedValueOnce(new Error('Storage unavailable'))
				}
				await expect(client().create(input)).rejects.toMatchObject({
					code: codes[failure],
					data: undefined,
				})
			}
			await expect(client().create(input)).rejects.toMatchObject({
				code: 'TOO_MANY_REQUESTS',
				data: { limit: 5, remaining: 0 },
			})
			expect(submissionRedis.evalsha).toHaveBeenCalledTimes(6)
		}
	)
	it('does not cache denied results locally', async () => {
		vi.mocked(submissionRedis.evalsha).mockResolvedValue([-1, 5])
		await expect(client().create(input)).rejects.toHaveProperty(
			'code',
			'TOO_MANY_REQUESTS'
		)
		vi.mocked(submissionRedis.evalsha).mockResolvedValue([4, 5])
		await expect(client().create(input)).resolves.toHaveProperty('id', ID)
		expect(submissionRedis.evalsha).toHaveBeenCalledTimes(2)
	})
	it('fails closed on Redis errors before any database or GitHub work', async () => {
		vi.mocked(submissionRedis.evalsha).mockRejectedValue(
			new Error('Redis unavailable')
		)
		const { matched, response } = await openApiHandler.handle(
			new Request('http://localhost/submissions', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(input),
			}),
			{ context: context() }
		)
		expect(matched).toBe(true)
		expect(response?.status).toBe(500)
		expect(select).not.toHaveBeenCalled()
		expect(fetchPublicGithubRepository).not.toHaveBeenCalled()
	})
	it('disables Upstash fail-open timeout and aborts stalled Redis requests', async () => {
		vi.restoreAllMocks()
		let signal: AbortSignal | undefined
		const fetchMock = vi.fn(
			(_url, options: RequestInit) =>
				new Promise<Response>((_resolve, reject) => {
					signal = options.signal ?? undefined
					signal?.addEventListener(
						'abort',
						() => reject(new Error('Redis request timed out')),
						{
							once: true,
						}
					)
				})
		)
		vi.stubGlobal('fetch', fetchMock)
		const outcome = client()
			.create(input)
			.then(
				() => 'unexpected success',
				(error: unknown) => error
			)
		await new Promise((resolve) => setTimeout(resolve, 5_100))
		expect(await outcome).toBeInstanceOf(Error)
		expect(signal?.aborted).toBe(true)
		expect(fetchMock).toHaveBeenCalledTimes(1)
		expect(select).not.toHaveBeenCalled()
		expect(fetchPublicGithubRepository).not.toHaveBeenCalled()
	}, 10_000)
})

describe.each(['rpc', 'rest'] as const)('%s transport', (transport) => {
	function httpClient() {
		const handler = transport === 'rpc' ? rpcHandler : openApiHandler
		const responses: Array<{
			status: number
			headers: { get(name: string): string | null }
		}> = []
		const customFetch: NonNullable<
			FetchLinkTransportOptions<object>['fetch']
		> = async (url, init) => {
			const request = new Request(url, init)
			const result = await handler.handle(request, { context: context() })
			if (!result.matched) {
				throw new Error('Unmatched request')
			}
			responses.push(result.response.clone())
			return result.response
		}
		const options = {
			origin: 'http://localhost',
			url: '/' as const,
			fetch: customFetch,
		}
		const link =
			transport === 'rpc'
				? new RPCLink(options)
				: new OpenAPILink(contracts, {
						...options,
						// The app preserves its REST status field; strip that extra
						// field when decoding oRPC v2's strict native error shape.
						customErrorResponseBodyDecoder: (body) => {
							const parsed = z
								.object({
									defined: z.boolean(),
									code: z.string(),
									message: z.string(),
									data: z.unknown().optional(),
								})
								.safeParse(body)
							return parsed.success
								? createORPCErrorFromJson({
										...parsed.data,
										data: parsed.data.data,
									})
								: undefined
						},
					})
		const caller: ContractRouterClient<typeof contracts> =
			createORPCClient(link)
		return { caller, responses }
	}
	it('returns typed native 429 data and rate-limit/retry headers', async () => {
		vi.mocked(submissionRedis.evalsha).mockResolvedValue([-1, 5])
		const { caller, responses } = httpClient()
		const rejection: unknown = await caller.submission
			.create(input)
			.catch((error: unknown) => error)
		expect(rejection).toMatchObject({
			code: 'TOO_MANY_REQUESTS',
			data: { limit: 5, remaining: 0 },
		})
		if (!(rejection instanceof ORPCError)) {
			throw new Error('Expected native oRPC error')
		}
		const response = responses[0]!
		const reset = Number(response.headers.get('ratelimit-reset'))
		expect(rejection.data).toEqual({ limit: 5, remaining: 0, reset })
		expect(rejection.defined).toBe(true)
		expect(reset).toBeGreaterThan(Date.now())
		expect(response.status).toBe(429)
		expect(response.headers.get('ratelimit-limit')).toBe('5')
		expect(response.headers.get('ratelimit-remaining')).toBe('0')
		expect(Number(response.headers.get('retry-after'))).toBe(
			Math.ceil((reset - Date.now()) / 1_000)
		)
		expect(fetchPublicGithubRepository).not.toHaveBeenCalled()
	})
	it('adds quota headers on success without Retry-After', async () => {
		const { caller, responses } = httpClient()
		await expect(caller.submission.create(input)).resolves.toEqual({
			id: ID,
			status: 'draft',
		})
		expect(responses[0]?.headers.get('ratelimit-limit')).toBe('5')
		expect(responses[0]?.headers.get('ratelimit-remaining')).toBe('4')
		expect(responses[0]?.headers.get('retry-after')).toBeNull()
	})
	it.each(['capacity', 'github'] as const)(
		'preserves %s 429 without limiter data',
		async (failure) => {
			if (failure === 'capacity') selectResults = [[], [{ count: 10 }]]
			else {
				vi.mocked(fetchPublicGithubRepository).mockRejectedValueOnce(
					new ORPCError('TOO_MANY_REQUESTS', { message: 'GitHub rate limit' })
				)
			}
			const { caller, responses } = httpClient()
			await expect(caller.submission.create(input)).rejects.toMatchObject({
				code: 'TOO_MANY_REQUESTS',
				data: undefined,
			})
			expect(responses[0]?.headers.get('ratelimit-remaining')).toBe('4')
			expect(responses[0]?.headers.get('retry-after')).toBeNull()
		}
	)
})
