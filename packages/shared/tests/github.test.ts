import { describe, expect, it } from 'vite-plus/test'

import {
	INVALID_REPOSITORY_URL_MESSAGE,
	UNSUPPORTED_GITHUB_HOST_MESSAGE,
	canonicalizeGithubUrl,
} from '@altstack/shared/lib/github'
import { createSubmissionInputSchema } from '@altstack/shared/schemas/submission'

interface ValidCase {
	name: string
	input: string
	owner: string
	repo: string
}

const validCases: Array<ValidCase> = [
	{
		name: 'shorthand',
		input: 'facebook/react',
		owner: 'facebook',
		repo: 'react',
	},
	{
		name: 'leading slash',
		input: '/facebook/react',
		owner: 'facebook',
		repo: 'react',
	},
	{
		name: 'multiple leading slashes',
		input: '///facebook/react',
		owner: 'facebook',
		repo: 'react',
	},
	{
		name: 'trailing slash shorthand',
		input: 'facebook/react/',
		owner: 'facebook',
		repo: 'react',
	},
	{
		name: 'surrounding whitespace',
		input: '  facebook/react  ',
		owner: 'facebook',
		repo: 'react',
	},
	{
		name: 'uppercase scheme, host, path with .git and slash',
		input: 'HTTPS://GitHub.com/Facebook/React.git/',
		owner: 'facebook',
		repo: 'react',
	},
	{
		name: 'https with .git suffix',
		input: 'https://github.com/facebook/react.git',
		owner: 'facebook',
		repo: 'react',
	},
	{
		name: 'uppercase .GIT suffix',
		input: 'https://github.com/facebook/react.GIT',
		owner: 'facebook',
		repo: 'react',
	},
	{
		name: '.git suffix with trailing slash',
		input: 'https://github.com/facebook/react.git/',
		owner: 'facebook',
		repo: 'react',
	},
	{
		name: 'http scheme normalizes to https',
		input: 'http://github.com/facebook/react',
		owner: 'facebook',
		repo: 'react',
	},
	{
		name: 'www host with http and query',
		input: 'http://www.github.com/facebook/react?tab=x',
		owner: 'facebook',
		repo: 'react',
	},
	{
		name: 'uppercase www host',
		input: 'https://WWW.GITHUB.COM/Facebook/React',
		owner: 'facebook',
		repo: 'react',
	},
	{
		name: 'tree subpath is ignored',
		input: 'https://github.com/facebook/react/tree/main',
		owner: 'facebook',
		repo: 'react',
	},
	{
		name: 'blob file subpath is ignored',
		input: 'https://github.com/facebook/react/blob/main/README.md',
		owner: 'facebook',
		repo: 'react',
	},
	{
		name: 'pull subpath is ignored',
		input: 'https://github.com/facebook/react/pull/123',
		owner: 'facebook',
		repo: 'react',
	},
	{
		name: 'query string is ignored',
		input: 'https://github.com/facebook/react?tab=repositories',
		owner: 'facebook',
		repo: 'react',
	},
	{
		name: 'hash is ignored',
		input: 'https://github.com/facebook/react#readme',
		owner: 'facebook',
		repo: 'react',
	},
	{
		name: 'everything combined',
		input:
			'  HTTPS://WWW.GitHub.com/Facebook/React.GIT/tree/main?tab=x#readme  ',
		owner: 'facebook',
		repo: 'react',
	},
	{
		name: 'bare host without scheme',
		input: 'github.com/facebook/react',
		owner: 'facebook',
		repo: 'react',
	},
	{
		name: 'bare host mixed case',
		input: 'GitHub.com/Facebook/React',
		owner: 'facebook',
		repo: 'react',
	},
	{
		name: 'bare www host',
		input: 'www.github.com/facebook/react',
		owner: 'facebook',
		repo: 'react',
	},
	{
		name: 'bare host with query',
		input: 'github.com/facebook/react?tab=x',
		owner: 'facebook',
		repo: 'react',
	},
	{
		name: 'shorthand with query',
		input: 'facebook/react?tab=x',
		owner: 'facebook',
		repo: 'react',
	},
	{
		name: 'shorthand with hash',
		input: 'facebook/react#readme',
		owner: 'facebook',
		repo: 'react',
	},
	{
		name: 'shorthand with subpath',
		input: 'facebook/react/blob/main/README.md',
		owner: 'facebook',
		repo: 'react',
	},
	{
		name: 'mixed case shorthand lowercases owner and repo',
		input: 'TanStack/Router',
		owner: 'tanstack',
		repo: 'router',
	},
	{
		name: 'dashes, numbers, dots and underscores',
		input: 'my-org-123/my.repo-name_2',
		owner: 'my-org-123',
		repo: 'my.repo-name_2',
	},
	{
		name: 'dotfile repo',
		input: 'torvalds/.dotfiles',
		owner: 'torvalds',
		repo: '.dotfiles',
	},
	{ name: 'single char names', input: 'a/b', owner: 'a', repo: 'b' },
	{
		name: 'max length owner (39 chars)',
		input: `${'o'.repeat(39)}/react`,
		owner: 'o'.repeat(39),
		repo: 'react',
	},
	{
		name: 'max length repo (100 chars)',
		input: `facebook/${'r'.repeat(100)}`,
		owner: 'facebook',
		repo: 'r'.repeat(100),
	},
	{
		name: 'explicit port is ignored',
		input: 'https://github.com:443/facebook/react',
		owner: 'facebook',
		repo: 'react',
	},
]

interface InvalidCase {
	name: string
	input: string
	message: string
}

const unsupportedHostCases: Array<InvalidCase> = [
	{
		name: 'gist subdomain',
		input: 'https://gist.github.com/facebook/abc123',
		message: UNSUPPORTED_GITHUB_HOST_MESSAGE,
	},
	{
		name: 'gitlab host',
		input: 'https://gitlab.com/facebook/react',
		message: UNSUPPORTED_GITHUB_HOST_MESSAGE,
	},
	{
		name: 'lookalike subdomain',
		input: 'https://github.com.evil.com/facebook/react',
		message: UNSUPPORTED_GITHUB_HOST_MESSAGE,
	},
	{
		name: 'lookalike domain',
		input: 'https://evilgithub.com/facebook/react',
		message: UNSUPPORTED_GITHUB_HOST_MESSAGE,
	},
	{
		name: 'other forge',
		input: 'https://bitbucket.org/facebook/react',
		message: UNSUPPORTED_GITHUB_HOST_MESSAGE,
	},
	{
		name: 'bare gist host',
		input: 'gist.github.com/facebook/abc123',
		message: UNSUPPORTED_GITHUB_HOST_MESSAGE,
	},
	{
		name: 'bare gitlab host',
		input: 'gitlab.com/facebook/react',
		message: UNSUPPORTED_GITHUB_HOST_MESSAGE,
	},
]

const malformedCases: Array<InvalidCase> = [
	{
		name: 'owner without repo',
		input: 'https://github.com/cuma-owner',
		message: INVALID_REPOSITORY_URL_MESSAGE,
	},
	{
		name: 'owner with trailing slash only',
		input: 'https://github.com/facebook/',
		message: INVALID_REPOSITORY_URL_MESSAGE,
	},
	{
		name: 'host only',
		input: 'https://github.com/',
		message: INVALID_REPOSITORY_URL_MESSAGE,
	},
	{
		name: 'double slash drops owner',
		input: 'https://github.com//react',
		message: INVALID_REPOSITORY_URL_MESSAGE,
	},
	{
		name: 'bare host with owner only',
		input: 'github.com/cuma-owner',
		message: INVALID_REPOSITORY_URL_MESSAGE,
	},
	{
		name: 'bare host only',
		input: 'github.com/',
		message: INVALID_REPOSITORY_URL_MESSAGE,
	},
	{
		name: 'single shorthand segment',
		input: 'cuma-owner',
		message: INVALID_REPOSITORY_URL_MESSAGE,
	},
	{ name: 'empty string', input: '', message: INVALID_REPOSITORY_URL_MESSAGE },
	{
		name: 'whitespace only',
		input: '   ',
		message: INVALID_REPOSITORY_URL_MESSAGE,
	},
	{
		name: 'slashes only',
		input: '///',
		message: INVALID_REPOSITORY_URL_MESSAGE,
	},
	{
		name: 'shorthand owner with trailing slash',
		input: 'facebook/',
		message: INVALID_REPOSITORY_URL_MESSAGE,
	},
	{
		name: 'shorthand owner with leading slash',
		input: '/facebook',
		message: INVALID_REPOSITORY_URL_MESSAGE,
	},
	{
		name: 'owner leading hyphen',
		input: '-facebook/react',
		message: INVALID_REPOSITORY_URL_MESSAGE,
	},
	{
		name: 'owner trailing hyphen',
		input: 'facebook-/react',
		message: INVALID_REPOSITORY_URL_MESSAGE,
	},
	{
		name: 'owner consecutive hyphens',
		input: 'face--book/react',
		message: INVALID_REPOSITORY_URL_MESSAGE,
	},
	{
		name: 'owner underscore',
		input: 'face_book/react',
		message: INVALID_REPOSITORY_URL_MESSAGE,
	},
	{
		name: 'space inside owner',
		input: 'face book/react',
		message: INVALID_REPOSITORY_URL_MESSAGE,
	},
	{
		name: 'space inside repo',
		input: 'facebook/my repo',
		message: INVALID_REPOSITORY_URL_MESSAGE,
	},
	{
		name: 'tab inside input',
		input: 'facebook/\treact',
		message: INVALID_REPOSITORY_URL_MESSAGE,
	},
	{
		name: 'repo that is only .git suffix',
		input: 'facebook/.git',
		message: INVALID_REPOSITORY_URL_MESSAGE,
	},
	{
		name: 'repo single dot',
		input: 'facebook/.',
		message: INVALID_REPOSITORY_URL_MESSAGE,
	},
	{
		name: 'repo double dot',
		input: 'facebook/..',
		message: INVALID_REPOSITORY_URL_MESSAGE,
	},
	{
		name: 'repo over 100 chars',
		input: `facebook/${'r'.repeat(101)}`,
		message: INVALID_REPOSITORY_URL_MESSAGE,
	},
	{
		name: 'owner over 39 chars',
		input: `${'o'.repeat(40)}/react`,
		message: INVALID_REPOSITORY_URL_MESSAGE,
	},
	{
		name: 'non http(s) protocol',
		input: 'ftp://github.com/facebook/react',
		message: INVALID_REPOSITORY_URL_MESSAGE,
	},
	{
		name: 'credentials in url',
		input: 'https://user@github.com/facebook/react',
		message: INVALID_REPOSITORY_URL_MESSAGE,
	},
	{
		name: 'plain sentence',
		input: 'just some words',
		message: INVALID_REPOSITORY_URL_MESSAGE,
	},
]

describe('canonicalizeGithubUrl', () => {
	it.each(validCases)('accepts $name', ({ input, owner, repo }) => {
		expect(canonicalizeGithubUrl(input)).toEqual({
			canonicalUrl: `https://github.com/${owner}/${repo}`,
			owner,
			repo,
		})
	})

	it.each(unsupportedHostCases)('rejects $name', ({ input, message }) => {
		expect(() => canonicalizeGithubUrl(input)).toThrow(message)
	})

	it.each(malformedCases)('rejects $name', ({ input, message }) => {
		expect(() => canonicalizeGithubUrl(input)).toThrow(message)
	})

	it('rejects ssh-style input instead of misparsing it', () => {
		// NOTE: `git@github.com:owner/repo.git` (SSH clone string) is rejected
		// for now; support can be added later if needed.
		expect(() =>
			canonicalizeGithubUrl('git@github.com:facebook/react.git')
		).toThrow(UNSUPPORTED_GITHUB_HOST_MESSAGE)
	})

	it.each([
		{ name: 'null', input: null },
		{ name: 'undefined', input: undefined },
		{ name: 'number', input: 123 },
	])('rejects non-string $name', ({ input }) => {
		expect(() => canonicalizeGithubUrl(input as unknown as string)).toThrow(
			INVALID_REPOSITORY_URL_MESSAGE
		)
	})
})

describe('createSubmissionInputSchema', () => {
	it('canonicalizes shorthand repository url', () => {
		expect(
			createSubmissionInputSchema.parse({
				name: 'Router',
				repositoryUrl: 'TanStack/Router',
			})
		).toEqual({
			name: 'Router',
			repositoryUrl: 'https://github.com/tanstack/router',
		})
	})

	it('canonicalizes full url with subpath and keeps website', () => {
		expect(
			createSubmissionInputSchema.parse({
				name: 'React',
				repositoryUrl: 'https://github.com/facebook/react/tree/main',
				websiteUrl: 'https://react.dev',
			})
		).toEqual({
			name: 'React',
			repositoryUrl: 'https://github.com/facebook/react',
			websiteUrl: 'https://react.dev',
		})
	})

	it('surfaces unsupported host message', () => {
		const result = createSubmissionInputSchema.safeParse({
			name: 'React',
			repositoryUrl: 'https://gitlab.com/facebook/react',
		})
		expect(result.success).toBe(false)
		const messages = !result.success
			? result.error.issues.map((issue) => issue.message)
			: []
		expect(messages).toContain(UNSUPPORTED_GITHUB_HOST_MESSAGE)
	})

	it('surfaces invalid url message for owner-only input', () => {
		const result = createSubmissionInputSchema.safeParse({
			name: 'React',
			repositoryUrl: 'https://github.com/cuma-owner',
		})
		expect(result.success).toBe(false)
		const messages = !result.success
			? result.error.issues.map((issue) => issue.message)
			: []
		expect(messages).toContain(INVALID_REPOSITORY_URL_MESSAGE)
	})
})
