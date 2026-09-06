import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'
import { z } from 'zod'

import {
	searchProjectsInputSchema,
	searchSortSchema,
} from '@altstack/shared/schemas/project'

import { FilterSection } from '#/components/filter-section'
import { HeroSection } from '#/components/hero-section'
import { ProjectListSection } from '#/components/project-list-section'
import { projectQueries } from '#/features/project/queries'

const searchSchema = searchProjectsInputSchema
	.pick({ category: true, q: true })
	.extend({
		sort: searchSortSchema.optional().catch('newest'),
		page: z.coerce.number().int().min(1).optional().catch(1),
	})

export const Route = createFileRoute('/_app/')({
	validateSearch: searchSchema,
	loaderDeps: ({ search: { category, page, q, sort } }) => {
		return {
			category,
			page,
			q,
			sort,
		}
	},
	loader: ({ context, deps }) =>
		context.queryClient.ensureQueryData(projectQueries.search(deps)),
	component: Home,
})

function Home() {
	const { category, page, q, sort } = Route.useSearch()

	return (
		<>
			<HeroSection />
			<FilterSection />
			<Suspense fallback={<div>Loading...</div>}>
				<ProjectListSection category={category} page={page} q={q} sort={sort} />
			</Suspense>
		</>
	)
}
