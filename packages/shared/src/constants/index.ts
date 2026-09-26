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

export const LOGO_PREFIX = 'projects/logos/' as const

export const LOGO_MIME = [
	'image/png',
	'image/jpeg',
	'image/webp',
	'image/gif',
] as const

export const LOGO_MAX_SIZE = 3 * 1024 * 1024
