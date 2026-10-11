import { createORPCClient, createORPCErrorFromJson } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import type { ContractRouterClient } from '@orpc/contract'
import { OpenAPILink } from '@orpc/openapi/fetch'
import { createRouterClient } from '@orpc/server'
import { RequestError } from 'octokit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { z } from 'zod'

import type { ORPCContext } from '@altstack/api/context'
import { contracts } from '@altstack/api/contracts'
import {
	fetchPublicGithubMetadata,
	fetchPublicGithubRepository,
	octokit,
} from '@altstack/api/github'
import { openApiHandler, rpcHandler } from '@altstack/api/handler'
import { routers } from '@altstack/api/routers'

import fixture from './fixtures/github-metadata.json'

const { limit } = vi.hoisted(() => {
	return { limit: vi.fn() }
})
vi.mock('@altstack/api/submission-rate-limit', () => {
	return {
		submissionRateLimiter: { limit },
	}
})

type GithubResponse = Awaited<ReturnType<typeof octokit.rest.repos.get>>
const databaseAccess = vi.fn(() => {
	throw new Error('Metadata must not access the database')
})
const database = new Proxy({}, { get: databaseAccess }) as ORPCContext['db']
function context(role: string | null = 'admin'): ORPCContext {
	return {
		db: database,
		auth: role
			? ({
					user: { id: '550e8400-e29b-41d4-a716-446655440000', role },
				} as ORPCContext['auth'])
			: null,
	}
}
function client(role: string | null = 'admin') {
	return createRouterClient(routers, { context: context(role) }).admin.project
}
function github(overrides: Record<string, unknown> = {}) {
	vi.mocked(octokit.rest.repos.get).mockResolvedValue({
		data: {
			id: 123,
			private: false,
			owner: { login: 'NewOwner' },
			name: 'NewRepo',
			stargazers_count: 123,
			forks_count: 45,
			description: ` ${fixture.output.description} `,
			homepage: ` ${fixture.output.websiteUrl} `,
			...overrides,
		},
	} as unknown as GithubResponse)
}
beforeEach(() => {
	vi.spyOn(octokit.rest.repos, 'get')
	github()
	databaseAccess.mockClear()
	limit.mockClear()
})
afterEach(() => {
	// oxlint-disable-next-line jest/no-standalone-expect -- Every case must remain a read without database access.
	expect(databaseAccess).not.toHaveBeenCalled()
	// oxlint-disable-next-line jest/no-standalone-expect -- The existing limiter stays submission-only.
	expect(limit).not.toHaveBeenCalled()
	vi.restoreAllMocks()
})

describe('admin GitHub metadata', () => {
	it.each([
		[null, 'UNAUTHORIZED'],
		['user', 'FORBIDDEN'],
	])('rejects %s without fetching', async (role, code) => {
		await expect(
			client(role).githubMetadata(fixture.input)
		).rejects.toMatchObject({ code })
		expect(octokit.rest.repos.get).not.toHaveBeenCalled()
	})
	it.each([
		'',
		'invalid',
		'https://gitlab.com/owner/repo',
		'https://github.com',
		'ftp://github.com/owner/repo',
	])('rejects invalid repository %s', async (repositoryUrl) => {
		await expect(
			client().githubMetadata({ repositoryUrl })
		).rejects.toMatchObject({ code: 'BAD_REQUEST' })
		expect(octokit.rest.repos.get).not.toHaveBeenCalled()
	})
	it('resolves transfers/renames and returns only trimmed metadata in one GitHub call', async () => {
		expect(await client().githubMetadata(fixture.input)).toEqual(fixture.output)
		expect(octokit.rest.repos.get).toHaveBeenCalledExactlyOnceWith({
			owner: 'oldowner',
			repo: 'oldrepo',
		})
	})
	it('returns stable repository identity and stats without exposing metadata', async () => {
		expect(await fetchPublicGithubRepository('oldowner', 'oldrepo')).toEqual({
			canonicalUrl: fixture.output.repositoryUrl,
			githubRepositoryId: 123,
			owner: 'newowner',
			repo: 'newrepo',
			stars: 123,
			forks: 45,
		})
		expect(octokit.rest.repos.get).toHaveBeenCalledTimes(1)
	})
	it.each([null, '', ' \n '])(
		'normalizes empty description %s to null',
		async (description) => {
			github({ description })
			expect(
				(await client().githubMetadata(fixture.input)).description
			).toBeNull()
		}
	)
	it('preserves long descriptions for correction', async () => {
		github({ description: ` ${'x'.repeat(500)} ` })
		expect((await client().githubMetadata(fixture.input)).description).toBe(
			'x'.repeat(500)
		)
	})
	it.each([
		null,
		'',
		'  ',
		'example.com',
		'//example.com',
		'javascript:alert(1)',
		'ftp://example.com',
		'https://',
		'not a url',
	])(
		'discards invalid homepage %s without guessing or fetching it',
		async (homepage) => {
			github({ homepage })
			expect(
				(await client().githubMetadata(fixture.input)).websiteUrl
			).toBeNull()
			expect(octokit.rest.repos.get).toHaveBeenCalledTimes(1)
		}
	)
	it.each(['http://example.com', 'https://example.com/path?q=1'])(
		'accepts an HTTP(S) homepage %s',
		async (homepage) => {
			github({ homepage: ` ${homepage} ` })
			expect((await client().githubMetadata(fixture.input)).websiteUrl).toBe(
				homepage
			)
		}
	)
	describe.each([fetchPublicGithubRepository, fetchPublicGithubMetadata])(
		'shared verification and error mapping: %s',
		(fetchRepository) => {
			it('rejects private repositories', async () => {
				github({ private: true })
				await expect(fetchRepository('owner', 'repo')).rejects.toMatchObject({
					code: 'BAD_REQUEST',
				})
			})
			it.each([
				[404, 'NOT_FOUND'],
				[403, 'TOO_MANY_REQUESTS'],
				[429, 'TOO_MANY_REQUESTS'],
				[500, 'INTERNAL_SERVER_ERROR'],
			])('maps upstream %s', async (status, code) => {
				vi.mocked(octokit.rest.repos.get).mockRejectedValue(
					new RequestError('Upstream failure', Number(status), {
						request: {
							method: 'GET',
							url: 'https://api.github.com/repos/owner/repo',
							headers: {},
						},
					})
				)
				await expect(fetchRepository('owner', 'repo')).rejects.toMatchObject({
					code,
				})
			})
			it('maps network failures', async () => {
				vi.mocked(octokit.rest.repos.get).mockRejectedValue(
					new Error('Network failure')
				)
				await expect(fetchRepository('owner', 'repo')).rejects.toMatchObject({
					code: 'INTERNAL_SERVER_ERROR',
				})
			})
		}
	)
	it.each(['rpc', 'rest'] as const)(
		'enforces auth and preserves the wire shape through %s',
		async (transport) => {
			for (const [role, expectedCode] of [
				[null, 'UNAUTHORIZED'],
				['user', 'FORBIDDEN'],
				['admin', null],
			] as const) {
				const handle = async (request: Request) => {
					const result =
						transport === 'rpc'
							? await rpcHandler.handle(request, {
									prefix: '/rpc',
									context: context(role),
								})
							: await openApiHandler.handle(request, { context: context(role) })
					if (!result.response) throw new Error('Unmatched request')
					return result.response
				}
				const wire = createORPCClient<ContractRouterClient<typeof contracts>>(
					transport === 'rpc'
						? new RPCLink({
								origin: 'http://localhost',
								url: '/rpc',
								fetch: (request, init) => handle(new Request(request, init)),
							})
						: new OpenAPILink(contracts, {
								origin: 'http://localhost',
								url: '/',
								fetch: (request, init) => handle(new Request(request, init)),
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
				)
				const result = wire.admin.project.githubMetadata(fixture.input)
				// oxlint-disable-next-line jest/no-conditional-expect -- The same wire matrix verifies authorized and unauthorized sessions.
				if (expectedCode) {
					// oxlint-disable-next-line jest/no-conditional-expect -- Unauthorized rows in the wire matrix must reject.
					await expect(result).rejects.toMatchObject({ code: expectedCode })
				}
				// oxlint-disable-next-line jest/no-conditional-expect -- Successful sessions verify the response shape.
				else expect(await result).toEqual(fixture.output)
			}
		}
	)
})
