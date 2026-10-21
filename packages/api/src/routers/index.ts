import type {
	InferRouterInputs,
	InferRouterOutputs,
	RouterClient,
} from '@orpc/server'

import { o } from '@altstack/api/base'
import { adminCategoryRouter } from '@altstack/api/routers/admin-category'
import { adminProjectRouter } from '@altstack/api/routers/admin-project'
import { altstackRouter } from '@altstack/api/routers/altstack'
import { bookmarkRouter } from '@altstack/api/routers/bookmark'
import { categoryRouter } from '@altstack/api/routers/category'
import { healthRouter } from '@altstack/api/routers/health'
import { projectRouter } from '@altstack/api/routers/project'
import { reportRouter } from '@altstack/api/routers/report'
import { submissionRouter } from '@altstack/api/routers/submission'
import { uploadRouter } from '@altstack/api/routers/upload'

export const routers = o.router({
	bookmark: bookmarkRouter,
	admin: {
		category: adminCategoryRouter,
		project: adminProjectRouter,
		upload: uploadRouter,
	},
	submission: submissionRouter,
	altstack: altstackRouter,
	category: categoryRouter,
	health: healthRouter,
	project: projectRouter,
	report: reportRouter,
})

export type ORPCRouterClient = RouterClient<typeof routers>

export type ORPCRouterInputs = InferRouterInputs<typeof routers>
export type ORPCRouterOutputs = InferRouterOutputs<typeof routers>
