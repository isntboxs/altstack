import { beforeEach, expect, it, vi } from 'vite-plus/test'

import { getClaimGithubAccessToken } from '@altstack/auth/server/github-access-token'

const { getAccessToken } = vi.hoisted(() => {
	return {
		getAccessToken:
			vi.fn<
				() => Promise<{ accessToken: string; accessTokenExpiresAt?: Date }>
			>(),
	}
})
vi.mock('@altstack/auth/server', () => {
	return { auth: { api: { getAccessToken } } }
})
beforeEach(() => {
	getAccessToken.mockReset()
})
it('uses Better Auth account-row selection and decryption/refresh for only the specified user', async () => {
	getAccessToken.mockResolvedValue({ accessToken: 'synthetic-user-token' })
	expect(await getClaimGithubAccessToken('user-a', 'account-row-a')).toBe(
		'synthetic-user-token'
	)
	expect(getAccessToken).toHaveBeenCalledExactlyOnceWith({
		body: { userId: 'user-a', accountId: 'account-row-a' },
	})
})
it('returns no credential on expired, missing or failed token resolution', async () => {
	getAccessToken.mockResolvedValueOnce({
		accessToken: 'expired',
		accessTokenExpiresAt: new Date(0),
	})
	expect(await getClaimGithubAccessToken('user-a', 'account-a')).toBeNull()
	getAccessToken.mockResolvedValueOnce({ accessToken: '' })
	expect(await getClaimGithubAccessToken('user-a', 'account-a')).toBeNull()
	getAccessToken.mockRejectedValue(new Error('Sensitive provider data'))
	expect(await getClaimGithubAccessToken('user-a', 'account-a')).toBeNull()
})
