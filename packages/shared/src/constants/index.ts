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
