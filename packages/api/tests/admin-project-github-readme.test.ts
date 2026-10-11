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
import { fetchPublicGithubReadme, octokit } from '@altstack/api/github'
import { openApiHandler, rpcHandler } from '@altstack/api/handler'
import { routers } from '@altstack/api/routers'

import fixture from './fixtures/github-readme.json'

const { limit } = vi.hoisted(() => {
	return { limit: vi.fn() }
})
vi.mock('@altstack/api/submission-rate-limit', () => {
	return {
		submissionRateLimiter: { limit },
	}
})

type GithubResponse = Awaited<ReturnType<typeof octokit.rest.repos.get>>
const externalFetch = vi.fn()
const databaseAccess = vi.fn(() => {
	throw new Error('README must not access the database')
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
			default_branch: 'main',
			...overrides,
		},
	} as unknown as GithubResponse)
}
beforeEach(() => {
	externalFetch
		.mockReset()
		.mockRejectedValue(new Error('Non-GitHub fetching is forbidden'))
	vi.spyOn(globalThis, 'fetch').mockImplementation(externalFetch)
	vi.spyOn(octokit.rest.repos, 'get')
	vi.spyOn(octokit.rest.repos, 'getCommit').mockResolvedValue({
		data: { sha: fixture.output.commitSha },
	} as unknown as Awaited<ReturnType<typeof octokit.rest.repos.getCommit>>)
	vi.spyOn(octokit.rest.repos, 'getReadme')
	readme()
	github()
	databaseAccess.mockClear()
	limit.mockClear()
})
afterEach(() => {
	// oxlint-disable-next-line jest/no-standalone-expect -- Every case must remain a read without database access.
	expect(databaseAccess).not.toHaveBeenCalled()
	// oxlint-disable-next-line jest/no-standalone-expect -- Only the three mocked GitHub API calls may access the network.
	expect(externalFetch).not.toHaveBeenCalled()
	// oxlint-disable-next-line jest/no-standalone-expect -- The existing limiter stays submission-only.
	expect(limit).not.toHaveBeenCalled()
	vi.restoreAllMocks()
})

function readme(overrides: Record<string, unknown> = {}) {
	vi.mocked(octokit.rest.repos.getReadme).mockResolvedValue({
		data: {
			path: fixture.output.path,
			name: 'README.md',
			type: 'file',
			size: Buffer.byteLength(fixture.output.markdown),
			encoding: 'base64',
			content: Buffer.from(fixture.output.markdown).toString('base64'),
			...overrides,
		},
	} as unknown as Awaited<ReturnType<typeof octokit.rest.repos.getReadme>>)
}
function upstream(status: number) {
	return new RequestError('Upstream failure', status, {
		request: {
			method: 'GET',
			url: 'https://api.github.com/repos/owner/repo',
			headers: {},
		},
	})
}

describe('admin GitHub README', () => {
	it.each([
		[null, 'UNAUTHORIZED'],
		['user', 'FORBIDDEN'],
	])('rejects %s without fetching', async (role, code) => {
		await expect(
			client(role).githubReadme(fixture.input)
		).rejects.toMatchObject({ code })
		expect(octokit.rest.repos.get).not.toHaveBeenCalled()
		expect(octokit.rest.repos.getReadme).not.toHaveBeenCalled()
	})
	it.each([
		'',
		'invalid',
		'https://gitlab.com/owner/repo',
		'ftp://github.com/owner/repo',
	])('rejects invalid repository %s', async (repositoryUrl) => {
		await expect(
			client().githubReadme({ repositoryUrl })
		).rejects.toMatchObject({ code: 'BAD_REQUEST' })
		expect(octokit.rest.repos.get).not.toHaveBeenCalled()
	})
	it('resolves a renamed repository and pins README and source to the default branch commit, not the file blob', async () => {
		expect(await client().githubReadme(fixture.input)).toEqual(fixture.output)
		expect(octokit.rest.repos.get).toHaveBeenCalledExactlyOnceWith({
			owner: 'oldowner',
			repo: 'oldrepo',
		})
		expect(octokit.rest.repos.getCommit).toHaveBeenCalledExactlyOnceWith({
			owner: 'newowner',
			repo: 'newrepo',
			ref: 'main',
		})
		expect(octokit.rest.repos.getReadme).toHaveBeenCalledExactlyOnceWith({
			owner: 'newowner',
			repo: 'newrepo',
			ref: fixture.output.commitSha,
			headers: { accept: 'application/vnd.github+json' },
		})
	})
	it('rejects private repositories before reading any content', async () => {
		github({ private: true })
		await expect(client().githubReadme(fixture.input)).rejects.toMatchObject({
			code: 'BAD_REQUEST',
			message: 'The GitHub repository must be public.',
		})
		expect(octokit.rest.repos.getReadme).not.toHaveBeenCalled()
	})
	it('distinguishes a missing repository from a missing README', async () => {
		vi.mocked(octokit.rest.repos.get).mockRejectedValueOnce(upstream(404))
		await expect(client().githubReadme(fixture.input)).rejects.toMatchObject({
			code: 'NOT_FOUND',
			message: 'Public GitHub repository not found.',
		})
		vi.mocked(octokit.rest.repos.getReadme).mockRejectedValueOnce(upstream(404))
		await expect(client().githubReadme(fixture.input)).rejects.toMatchObject({
			code: 'NOT_FOUND',
			message: 'No README was found in this GitHub repository.',
		})
	})
	it.each(['get', 'getCommit', 'getReadme'] as const)(
		'maps rate limits, upstream and network failures at %s',
		async (method) => {
			for (const [status, code] of [
				[403, 'TOO_MANY_REQUESTS'],
				[429, 'TOO_MANY_REQUESTS'],
				[500, 'INTERNAL_SERVER_ERROR'],
			] as const) {
				vi.mocked(octokit.rest.repos[method]).mockRejectedValueOnce(
					upstream(status)
				)
				await expect(
					fetchPublicGithubReadme('oldowner', 'oldrepo')
				).rejects.toMatchObject({ code })
			}
			vi.mocked(octokit.rest.repos[method]).mockRejectedValueOnce(
				new Error('Network failed')
			)
			await expect(
				fetchPublicGithubReadme('oldowner', 'oldrepo')
			).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' })
		}
	)
	it('reports an empty repository default branch', async () => {
		vi.mocked(octokit.rest.repos.getCommit).mockRejectedValueOnce(upstream(404))
		await expect(client().githubReadme(fixture.input)).rejects.toMatchObject({
			code: 'NOT_FOUND',
			message: 'The repository has no readable default branch commit.',
		})
	})
	it.each(['README.MD', 'README.Markdown', 'README.TXT', 'README'])(
		'supports %s and normalizes line endings',
		async (path) => {
			readme({
				path,
				content: Buffer.from('# Example\r\n\r\nA public README.').toString(
					'base64'
				),
			})
			expect((await client().githubReadme(fixture.input)).markdown).toBe(
				fixture.output.markdown
			)
		}
	)
	it.each([
		[{ path: 'README.rst' }, 'Unsupported README format'],
		[{ size: 102401 }, '100 KiB'],
		[{ content: Buffer.alloc(102401, 'x').toString('base64') }, '100 KiB'],
		[{ content: '' }, 'empty'],
		[{ content: Buffer.from(' \r\n ').toString('base64') }, 'empty'],
		[
			{ content: Buffer.from('<script>alert(1)</script>').toString('base64') },
			'no supported content',
		],
		[{ encoding: 'none' }, 'encoding'],
		[{ content: '!!!' }, 'encoding'],
		[{ content: '/w==' }, 'encoding'],
		[{ content: 'AA==' }, 'encoding'],
		[{ path: '../README.md' }, 'path'],
	])(
		'rejects invalid README %j without truncation',
		async (overrides, message) => {
			readme(overrides)
			await expect(client().githubReadme(fixture.input)).rejects.toMatchObject({
				code: 'BAD_REQUEST',
				// oxlint-disable-next-line typescript/no-unsafe-assignment -- Vitest's asymmetric matcher is intentionally typed as any.
				message: expect.stringContaining(message),
			})
		}
	)
	it('accepts the exact decoded 100 KiB boundary without truncating', async () => {
		readme({
			size: 102400,
			content: Buffer.alloc(102400, 'x').toString('base64'),
		})
		expect((await client().githubReadme(fixture.input)).markdown).toHaveLength(
			102400
		)
	})
})

describe('README wire contract', () => {
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
				const result = wire.admin.project.githubReadme(fixture.input)
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
