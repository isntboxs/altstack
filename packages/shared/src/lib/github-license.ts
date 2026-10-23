import { spdxLicenseIds } from '@altstack/shared/lib/spdx-license-ids'

// GitHub's repository license-simple payload. `url` is API JSON, not a document.
export interface GithubLicensePayload {
	key: string
	name: string
	spdx_id: string | null
	html_url?: string
}

function normalizedText(value?: string | null) {
	const text = value?.trim()
	return text === '' ? null : (text ?? null)
}

export function normalizeGithubLicense(license?: GithubLicensePayload | null) {
	const licenseKey = normalizedText(license?.key)
	const licenseName = normalizedText(license?.name)
	const reportedSpdxId = normalizedText(license?.spdx_id)
	// A syntactically plausible custom name is not evidence of an SPDX license.
	const recognizedId = reportedSpdxId
		? spdxLicenseIds.get(reportedSpdxId.toLowerCase())
		: undefined
	const licenseSpdxId = recognizedId ?? reportedSpdxId
	const licenseSlug = recognizedId?.toLowerCase() ?? null
	let licenseUrl: string | null = null
	if (recognizedId && license?.html_url) {
		try {
			const url = new URL(license.html_url)
			if (
				url.protocol === 'https:' &&
				!url.username &&
				!url.password &&
				url.hostname !== 'api.github.com'
			) {
				licenseUrl = url.href
			}
		} catch {
			/* Ignore malformed upstream document URLs. */
		}
	}
	if (recognizedId && !licenseUrl) {
		licenseUrl = `https://spdx.org/licenses/${encodeURIComponent(recognizedId)}.html`
	}
	return { licenseKey, licenseName, licenseSpdxId, licenseSlug, licenseUrl }
}

export function githubLicenseMetadata(repository: {
	license?: GithubLicensePayload | null
	archived?: boolean
}) {
	return {
		...normalizeGithubLicense(repository.license),
		archived:
			typeof repository.archived === 'boolean' ? repository.archived : null,
	}
}
