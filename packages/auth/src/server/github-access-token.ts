import { auth } from '@altstack/auth/server'

// Trusted server callers supply an account row already selected for the current
// user. Better Auth owns decryption, refresh and account-ownership validation.
export async function getClaimGithubAccessToken(
	userId: string,
	accountId: string
) {
	try {
		const token = await auth.api.getAccessToken({ body: { userId, accountId } })
		if (
			token.accessTokenExpiresAt &&
			token.accessTokenExpiresAt.getTime() <= Date.now()
		) {
			return null
		}
		return token.accessToken || null
	} catch {
		return null
	}
}
