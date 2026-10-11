import { adminCategoryContract } from '@altstack/api/contracts/admin-category'
import { adminProjectContract } from '@altstack/api/contracts/admin-project'
import { altstackContract } from '@altstack/api/contracts/altstack'
import { categoryContract } from '@altstack/api/contracts/category'
import { healthContract } from '@altstack/api/contracts/health'
import { projectContract } from '@altstack/api/contracts/project'
import { submissionContract } from '@altstack/api/contracts/submission'
import { uploadContract } from '@altstack/api/contracts/upload'

export const contracts = {
	admin: {
		category: adminCategoryContract,
		project: adminProjectContract,
		upload: uploadContract,
	},
	submission: submissionContract,
	altstack: altstackContract,
	category: categoryContract,
	health: healthContract,
	project: projectContract,
} as const
