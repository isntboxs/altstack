import { altstackContract } from '@altstack/api/contracts/altstack'
import { healthContract } from '@altstack/api/contracts/health'

export const contracts = {
	altstack: altstackContract,
	health: healthContract,
} as const
