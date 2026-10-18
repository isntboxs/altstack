// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import '#/middlewares/auth-middleware'

const { getSession, responseHeaders, runMiddleware } = vi.hoisted(() => {
	return {
		getSession: vi.fn<
			(options: {
				fetchOptions: {
					headers: HeadersInit
					throw: boolean
					onResponse: (options: { response: Response }) => void
				}
			}) => Promise<unknown>
		>(),
		responseHeaders: new Headers(),
		runMiddleware:
			vi.fn<
				(options: {
					request: Request
					next: (options: { context: { auth: unknown } }) => Promise<unknown>
				}) => Promise<unknown>
			>(),
	}
})
vi.mock('@altstack/auth/client', () => {
	return { authClient: { getSession } }
})
vi.mock('@tanstack/react-start/server', () => {
	return { getResponseHeaders: () => responseHeaders }
})
vi.mock('@tanstack/react-start', () => {
	return {
		createMiddleware: () => {
			return {
				server: (
					handler: Parameters<typeof runMiddleware.mockImplementation>[0]
				) => {
					runMiddleware.mockImplementation(handler)
				},
			}
		},
	}
})

beforeEach(() => {
	getSession.mockReset().mockResolvedValue(null)
	responseHeaders.delete('set-cookie')
})

function run(cookie?: string) {
	return runMiddleware({
		request: new Request('https://app.example.test/submit', {
			headers: {
				host: 'app.example.test',
				'content-length': '123',
				...(cookie ? { cookie } : {}),
			},
		}),
		next: ({ context }) => Promise.resolve(context.auth),
	})
}

describe('SSR auth middleware', () => {
	it('forwards the incoming cookie and passes the session directly to route context', async () => {
		const session = {
			user: { id: 'synthetic-user' },
			session: { id: 'synthetic-session' },
		}
		getSession.mockResolvedValue(session)
		expect(await run('__Secure-better-auth.session_token=synthetic')).toBe(
			session
		)
		const { fetchOptions } = getSession.mock.calls[0][0]
		expect([...new Headers(fetchOptions.headers)]).toEqual([
			['cookie', '__Secure-better-auth.session_token=synthetic'],
		])
		expect(fetchOptions.throw).toBe(true)
	})

	it('passes null for an anonymous request', async () => {
		expect(await run()).toBeNull()
		expect(
			new Headers(getSession.mock.calls[0][0].fetchOptions.headers).get(
				'cookie'
			)
		).toBe('')
	})

	it('preserves separate refresh/expiry cookies and existing response cookies', async () => {
		const cookies = [
			'better-auth.session_token=refreshed; Path=/; HttpOnly; SameSite=Lax',
			'better-auth.session_data=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
		]
		responseHeaders.append('set-cookie', 'existing=kept; Path=/')
		getSession.mockImplementation(({ fetchOptions }) => {
			const headers = new Headers()
			for (const cookie of cookies) headers.append('set-cookie', cookie)
			fetchOptions.onResponse({ response: new Response('null', { headers }) })
			return Promise.resolve(null)
		})
		await run()
		expect(responseHeaders.getSetCookie()).toEqual([
			'existing=kept; Path=/',
			...cookies,
		])
	})

	it('propagates API failures instead of treating them as an anonymous session', async () => {
		const failure = new Error('Synthetic auth API failure')
		getSession.mockRejectedValue(failure)
		await expect(run()).rejects.toBe(failure)
	})
})
