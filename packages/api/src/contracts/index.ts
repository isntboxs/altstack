import { adminProjectContract } from '@altstack/api/contracts/admin-project'
import { altstackContract } from '@altstack/api/contracts/altstack'
import { healthContract } from '@altstack/api/contracts/health'
import { projectContract } from '@altstack/api/contracts/project'

export const contracts = {
	admin: {
		project: adminProjectContract,
	},
	altstack: altstackContract,
	health: healthContract,
	project: projectContract,
} as const
