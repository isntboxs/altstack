import { altstackContract } from '@altstack/api/contracts/altstack'
import { healthContract } from '@altstack/api/contracts/health'
import { projectContract } from '@altstack/api/contracts/project'

export const contracts = {
	altstack: altstackContract,
	health: healthContract,
	project: projectContract,
} as const
