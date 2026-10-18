import { betterAuth } from 'better-auth'
import { memoryAdapter } from 'better-auth/adapters/memory'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { createAuthConfig } from '@altstack/auth/server/config'

const { env } = vi.hoisted(() => {
	return {
		env: {
			APP_NAME: 'AltStack test',
			BETTER_AUTH_URL: 'https://api.example.test',
			BETTER_AUTH_SECRET: 'synthetic-test-secret-at-least-32-characters',
			BETTER_AUTH_COOKIE_DOMAIN: undefined as string | undefined,
			CORS_ORIGINS: ['https://app.example.test'],
			GITHUB_CLIENT_ID: 'synthetic-client',
			GITHUB_CLIENT_SECRET: 'synthetic-github-secret-at-least-32-characters',
		},
	}
})
vi.mock('@altstack/env/server', () => {
	return { env }
})
vi.mock('@altstack/db', () => {
	return { db: {} }
})

beforeEach(() => {
	env.BETTER_AUTH_URL = 'https://api.example.test'
	env.BETTER_AUTH_COOKIE_DOMAIN = undefined
	env.CORS_ORIGINS = ['https://app.example.test']
})

function createTestAuth() {
	const config = createAuthConfig()
	return betterAuth({
		...config,
		// Better Auth skips origin checks in test mode; exercise production behavior.
		advanced: { ...config.advanced, disableOriginCheck: false },
		database: memoryAdapter({
			user: [],
			session: [],
			account: [],
			verification: [],
		}),
	})
}

async function signUp(origin = env.CORS_ORIGINS[0]!, cookie?: string) {
	return createTestAuth().handler(
		new Request(`${env.BETTER_AUTH_URL}/api/auth/sign-up/email`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				origin,
				...(cookie ? { cookie } : {}),
			},
			body: JSON.stringify({
				email: 'synthetic@example.test',
				name: 'Synthetic user',
				password: 'synthetic-test-password',
			}),
		})
	)
}

describe('auth cookie scope', () => {
	it('uses the configured cookie scope when starting GitHub OAuth without contacting GitHub', async () => {
		env.BETTER_AUTH_COOKIE_DOMAIN = 'example.test'
		const response = await createTestAuth().handler(
			new Request(`${env.BETTER_AUTH_URL}/api/auth/sign-in/social`, {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					origin: env.CORS_ORIGINS[0]!,
				},
				body: JSON.stringify({
					provider: 'github',
					callbackURL: 'https://app.example.test/',
					disableRedirect: true,
				}),
			})
		)
		expect(response.status).toBe(200)
		const cookies = response.headers.getSetCookie()
		expect(cookies.length).toBeGreaterThan(0)
		for (const cookie of cookies) {
			for (const attribute of [
				'Domain=example.test',
				'HttpOnly',
				'Secure',
				'SameSite=Lax',
			]) {
				expect(cookie).toContain(attribute)
			}
		}
	})

	it('issues secure shared cookies only for the explicitly configured parent', async () => {
		env.BETTER_AUTH_COOKIE_DOMAIN = 'example.test'
		const response = await signUp()
		expect(response.status).toBe(200)
		const cookie = response.headers
			.getSetCookie()
			.find((value) => value.startsWith('__Secure-better-auth.session_token='))
		expect(cookie).toBeDefined()
		for (const attribute of [
			'Domain=example.test',
			'Path=/',
			'HttpOnly',
			'Secure',
			'SameSite=Lax',
		]) {
			expect(cookie).toContain(attribute)
		}
	})

	it('keeps HTTPS cookies host-only when the parent domain is unset', async () => {
		const response = await signUp()
		expect(response.status).toBe(200)
		const cookies = response.headers.getSetCookie()
		expect(cookies.length).toBeGreaterThan(0)
		for (const cookie of cookies) expect(cookie).not.toMatch(/;\s*domain=/i)
	})

	it('keeps localhost cookies host-only and usable over local HTTP', async () => {
		env.BETTER_AUTH_URL = 'http://localhost:3009'
		env.CORS_ORIGINS = ['http://localhost:3010']
		const response = await signUp()
		expect(response.status).toBe(200)
		const cookie = response.headers
			.getSetCookie()
			.find((value) => value.startsWith('better-auth.session_token='))
		expect(cookie).toBeDefined()
		expect(cookie).toContain('HttpOnly')
		expect(cookie).toContain('SameSite=Lax')
		expect(cookie).not.toMatch(/;\s*(domain=|secure)/i)
	})

	it('continues rejecting untrusted origins with shared cookies enabled', async () => {
		env.BETTER_AUTH_COOKIE_DOMAIN = 'example.test'
		const response = await signUp(
			'https://untrusted.example.test',
			'better-auth.session_token=synthetic'
		)
		expect(response.status).toBe(403)
		expect(response.headers.getSetCookie()).toHaveLength(0)
	})
})
