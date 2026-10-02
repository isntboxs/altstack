export * from '@altstack/shared/constants/orpc-errors'

export const PROJECT_STATUS = [
	'draft',
	'published',
	'rejected',
	'removed',
] as const

export const AUDIT_ACTIONS = ['project_created', 'project_removed'] as const

export type ProjectStatus = (typeof PROJECT_STATUS)[number]

export type AuditAction = (typeof AUDIT_ACTIONS)[number]

export const TMP_LOGO_PREFIX = 'tmp/logos/' as const

export const TMP_SCREENSHOT_PREFIX = 'tmp/screenshots/' as const

export const PROJECT_IMAGE_ROOT_PREFIX = 'projects/' as const

export const LOGO_MIME = [
	'image/png',
	'image/jpeg',
	'image/webp',
	'image/gif',
] as const

export const LOGO_MAX_SIZE = 3 * 1024 * 1024

export const TMP_PROJECT_PREFIX = 'tmp/' as const

export const SCREENSHOT_MIME = [
	'image/png',
	'image/jpeg',
	'image/webp',
	'image/gif',
] as const

export const SCREENSHOT_MAX_SIZE = 5 * 1024 * 1024
