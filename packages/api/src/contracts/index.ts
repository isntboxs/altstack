import { altstackContract } from '@altstack/api/contracts/altstack'
import { healthContract } from '@altstack/api/contracts/health'
import { projectContract } from '@altstack/api/contracts/project'
import { submissionContract } from '@altstack/api/contracts/submission'

export const contracts = {
	altstack: altstackContract,
	health: healthContract,
	project: projectContract,
	submission: submissionContract,
} as const
