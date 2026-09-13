export interface CanonicalGithubRepo {
	canonicalUrl: string
	owner: string
	repo: string
}

export const UNSUPPORTED_GITHUB_HOST_MESSAGE =
	'Currently only GitHub repositories are supported'
export const INVALID_REPOSITORY_URL_MESSAGE = 'Invalid repository URL'

const OWNER_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i
const REPO_RE = /^[a-z\d._-]+$/i
const GIT_SUFFIX_RE = /\.git$/i
const HAS_SCHEME_RE = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//
const GITHUB_BARE_RE = /^(www\.)?github\.com(?=[/?#:]|$)/i

function parseGithubPath(
	ownerRaw: string,
	repoRaw: string
): CanonicalGithubRepo {
	let owner = ownerRaw
	let repo = repoRaw

	try {
		owner = decodeURIComponent(owner)
		repo = decodeURIComponent(repo)
	} catch {
		throw new Error(INVALID_REPOSITORY_URL_MESSAGE)
	}

	if (GIT_SUFFIX_RE.test(repo)) {
		repo = repo.slice(0, -4)
	}

	if (!owner || !repo) {
		throw new Error(INVALID_REPOSITORY_URL_MESSAGE)
	}

	if (repo.length > 100 || repo === '.' || repo === '..') {
		throw new Error(INVALID_REPOSITORY_URL_MESSAGE)
	}

	if (!OWNER_RE.test(owner) || !REPO_RE.test(repo)) {
		throw new Error(INVALID_REPOSITORY_URL_MESSAGE)
	}

	const normalizedOwner = owner.toLowerCase()
	const normalizedRepo = repo.toLowerCase()

	return {
		canonicalUrl: `https://github.com/${normalizedOwner}/${normalizedRepo}`,
		owner: normalizedOwner,
		repo: normalizedRepo,
	}
}

function segmentsFromUrl(url: URL): [string, string] {
	const segments = url.pathname.split('/').filter(Boolean)
	if (segments.length < 2 || !segments[0] || !segments[1]) {
		throw new Error(INVALID_REPOSITORY_URL_MESSAGE)
	}
	return [segments[0], segments[1]]
}

export function canonicalizeGithubUrl(input: string): CanonicalGithubRepo {
	if (typeof input !== 'string') {
		throw new Error(INVALID_REPOSITORY_URL_MESSAGE)
	}

	const trimmed = input.trim()
	if (!trimmed) {
		throw new Error(INVALID_REPOSITORY_URL_MESSAGE)
	}

	if (/\s/.test(trimmed)) {
		throw new Error(INVALID_REPOSITORY_URL_MESSAGE)
	}

	if (HAS_SCHEME_RE.test(trimmed)) {
		let url: URL
		try {
			url = new URL(trimmed)
		} catch {
			throw new Error(INVALID_REPOSITORY_URL_MESSAGE)
		}

		const protocol = url.protocol.toLowerCase()
		if (protocol !== 'http:' && protocol !== 'https:') {
			throw new Error(INVALID_REPOSITORY_URL_MESSAGE)
		}

		const host = url.hostname.toLowerCase()
		if (host !== 'github.com' && host !== 'www.github.com') {
			throw new Error(UNSUPPORTED_GITHUB_HOST_MESSAGE)
		}

		if (url.username || url.password) {
			throw new Error(INVALID_REPOSITORY_URL_MESSAGE)
		}

		const [ownerRaw, repoRaw] = segmentsFromUrl(url)
		return parseGithubPath(ownerRaw, repoRaw)
	}

	const noLeadingSlash = trimmed.replace(/^\/+/, '')
	if (!noLeadingSlash) {
		throw new Error(INVALID_REPOSITORY_URL_MESSAGE)
	}

	if (GITHUB_BARE_RE.test(noLeadingSlash)) {
		let url: URL
		try {
			url = new URL(`https://${noLeadingSlash}`)
		} catch {
			throw new Error(INVALID_REPOSITORY_URL_MESSAGE)
		}

		const host = url.hostname.toLowerCase()
		if (host !== 'github.com' && host !== 'www.github.com') {
			throw new Error(UNSUPPORTED_GITHUB_HOST_MESSAGE)
		}

		if (url.username || url.password) {
			throw new Error(INVALID_REPOSITORY_URL_MESSAGE)
		}

		const [ownerRaw, repoRaw] = segmentsFromUrl(url)
		return parseGithubPath(ownerRaw, repoRaw)
	}

	const pathPart = noLeadingSlash.split(/[?#]/)[0] ?? ''
	const segments = pathPart.split('/').filter(Boolean)
	if (segments.length < 2 || !segments[0] || !segments[1]) {
		throw new Error(INVALID_REPOSITORY_URL_MESSAGE)
	}

	const [ownerRaw, repoRaw] = segments as [string, string]

	if (ownerRaw.includes('.') || ownerRaw.includes(':')) {
		throw new Error(UNSUPPORTED_GITHUB_HOST_MESSAGE)
	}

	return parseGithubPath(ownerRaw, repoRaw)
}
