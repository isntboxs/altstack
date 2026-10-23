import { adminCategoryContract } from '@altstack/api/contracts/admin-category'
import { adminFeaturedContract } from '@altstack/api/contracts/admin-featured'
import { adminProjectContract } from '@altstack/api/contracts/admin-project'
import { adminReportContract } from '@altstack/api/contracts/admin-report'
import { altstackContract } from '@altstack/api/contracts/altstack'
import { bookmarkContract } from '@altstack/api/contracts/bookmark'
import { categoryContract } from '@altstack/api/contracts/category'
import { healthContract } from '@altstack/api/contracts/health'
import { licenseContract } from '@altstack/api/contracts/license'
import { projectContract } from '@altstack/api/contracts/project'
import { reportContract } from '@altstack/api/contracts/report'
import { submissionContract } from '@altstack/api/contracts/submission'
import { tagContract, adminTagContract } from '@altstack/api/contracts/tag'
import { uploadContract } from '@altstack/api/contracts/upload'

export const contracts = {
	license: licenseContract,
	tag: tagContract,
	bookmark: bookmarkContract,
	admin: {
		tag: adminTagContract,
		featured: adminFeaturedContract,
		report: adminReportContract,
		category: adminCategoryContract,
		project: adminProjectContract,
		upload: uploadContract,
	},
	submission: submissionContract,
	altstack: altstackContract,
	category: categoryContract,
	health: healthContract,
	project: projectContract,
	report: reportContract,
} as const
