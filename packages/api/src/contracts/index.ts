import { healthContract } from '@cort/api/contracts/health.contract'

export const orpcContracts = {
	health: healthContract,
} as const
