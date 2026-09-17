import { createColumnHelper } from '@tanstack/react-table'

import type { ORPCRouterOutputs } from '@altstack/api/routers'

import type { DataTableFeatures } from '#/utils/data-table-features'

export type Submission = ORPCRouterOutputs['submission']['list'][number]

const columnHelper = createColumnHelper<DataTableFeatures, Submission>()

export const submissionColumns = columnHelper.columns([
	columnHelper.accessor('name', {
		header: 'Name',
	}),

	columnHelper.accessor('repositoryUrl', {
		header: 'Repository',
	}),

	columnHelper.accessor('websiteUrl', {
		header: 'Website',
	}),

	columnHelper.accessor('status', {
		header: 'Status',
	}),
])
