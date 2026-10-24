import { ORPCError } from '@orpc/server'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import { getClaimGithubAccessToken } from '@altstack/auth/server/github-access-token'

import type { db } from '@altstack/db'
import { account, githubRepository, project } from '@altstack/db/schemas'

import { canonicalizeGithubUrl } from '@altstack/shared/lib/github'
import type { ClaimGithubEvidence } from '@altstack/shared/schemas/ownership'

const identitySchema = z.object({
	id: z.number().int().positive(),
	login: z.string().min(1).max(100),
})
const repositorySchema = z.object({
	id: z.number().int().positive(),
	private: z.boolean(),
	permissions: z
		.object({
			admin: z.boolean(),
			maintain: z.boolean().optional(),
			push: z.boolean(),
			triage: z.boolean().optional(),
			pull: z.boolean(),
		})
		.optional(),
})
async function githubJson(path: string, token: string) {
	const response = await fetch(`https://api.github.com${path}`, {
		headers: {
			authorization: `Bearer ${token}`,
			accept: 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2026-03-10',
		},
		signal: AbortSignal.timeout(8000),
		redirect: 'error',
	})
	if (!response.ok) throw new Error('GitHub check unavailable')
	const data: unknown = await response.json()
	return data
}

export async function checkClaimGithub(
	database: Pick<typeof db, 'select'>,
	userId: string,
	projectId: string
) {
	const [target] = await database
		.select({
			repositoryUrl: project.repositoryUrl,
			repositoryId: githubRepository.githubRepositoryId,
		})
		.from(project)
		.innerJoin(githubRepository, eq(githubRepository.projectId, project.id))
		.where(and(eq(project.id, projectId), eq(project.status, 'published')))
	if (!target) throw new ORPCError('NOT_FOUND')
	const accounts = await database
		.select({ id: account.id, accountId: account.accountId })
		.from(account)
		.where(and(eq(account.userId, userId), eq(account.providerId, 'github')))
		.limit(2)
	const linked = accounts.length === 1 ? accounts[0] : undefined
	const evidence: ClaimGithubEvidence = {
		status: linked ? 'unavailable' : 'disconnected',
		permission: 'unknown',
		reason: linked ? 'reconnect' : 'account_required',
		githubUserId: linked?.accountId ?? null,
		login: null,
		repositoryId: null,
		checkedAt: new Date().toISOString(),
	}
	const result = {
		evidence,
		projectId,
		repositoryUrl: target.repositoryUrl,
		repositoryIdentity: target.repositoryId,
		accountId: linked?.id ?? null,
	}
	if (!linked) return result
	const token = await getClaimGithubAccessToken(userId, linked.id)
	if (!token) return result
	try {
		const identity = identitySchema.parse(await githubJson('/user', token))
		if (String(identity.id) !== linked.accountId) {
			evidence.status = 'denied'
			evidence.reason = 'identity_mismatch'
			return result
		}
		evidence.login = identity.login
		const repo = canonicalizeGithubUrl(target.repositoryUrl)
		const repository = repositorySchema.parse(
			await githubJson(
				`/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}`,
				token
			)
		)
		evidence.repositoryId = String(repository.id)
		if (
			repository.private ||
			(target.repositoryId !== null &&
				String(target.repositoryId) !== evidence.repositoryId)
		) {
			evidence.status = 'denied'
			evidence.reason = 'repository_changed'
			return result
		}
		if (!repository.permissions) {
			evidence.reason = 'github_unavailable'
			return result
		}
		const p = repository.permissions
		evidence.permission = p.admin
			? 'admin'
			: p.maintain
				? 'maintain'
				: p.push
					? 'write'
					: p.triage
						? 'triage'
						: p.pull
							? 'read'
							: 'none'
		evidence.status =
			p.admin || p.maintain ? 'verified' : p.push ? 'limited' : 'denied'
		evidence.reason =
			evidence.status === 'denied' ? 'insufficient_access' : null
	} catch {
		evidence.reason = 'github_unavailable'
	}
	return result
}

export function requireClaimGithub(evidence: ClaimGithubEvidence) {
	if (evidence.status === 'disconnected') {
		throw new ORPCError('FORBIDDEN', {
			message: 'Connect your GitHub account before requesting access.',
		})
	}
	if (evidence.status === 'denied') {
		throw new ORPCError('FORBIDDEN', {
			message:
				evidence.reason === 'insufficient_access'
					? 'Your GitHub account does not have write or maintainer access to this repository.'
					: 'The GitHub account or repository identity changed. Reconnect GitHub or ask an admin to check the listing.',
		})
	}
}

export async function lockClaimGithubAccount(
	database: Pick<typeof db, 'select'>,
	userId: string,
	result: Awaited<ReturnType<typeof checkClaimGithub>>,
	repositoryUrl: string
) {
	if (repositoryUrl !== result.repositoryUrl || !result.accountId) {
		throw new ORPCError('CONFLICT', {
			message: 'The project or linked account changed. Check GitHub again.',
		})
	}
	const [linked] = await database
		.select({ id: account.id })
		.from(account)
		.where(
			and(
				eq(account.id, result.accountId),
				eq(account.userId, userId),
				eq(account.providerId, 'github'),
				eq(account.accountId, result.evidence.githubUserId ?? '')
			)
		)
		.for('share')
	if (!linked) {
		throw new ORPCError('CONFLICT', {
			message: 'Your GitHub account changed. Check GitHub again.',
		})
	}
	const [repository] = await database
		.select({ id: githubRepository.githubRepositoryId })
		.from(githubRepository)
		.where(eq(githubRepository.projectId, result.projectId))
		.for('share')
	if (!repository || repository.id !== result.repositoryIdentity) {
		throw new ORPCError('CONFLICT', {
			message: 'The repository identity changed. Check GitHub again.',
		})
	}
}
