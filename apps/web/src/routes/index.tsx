import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { FilterSection } from '#/components/filter-section'
import { HeroSection } from '#/components/hero-section'
import { ProjectListSection } from '#/components/project-list-section'
import { projectQueries } from '#/features/project/queries'

const searchSchema = z.object({
	limit: z.coerce.number().int().min(1).max(50).optional(),
	page: z.coerce.number().int().min(1).optional(),
})

export const Route = createFileRoute('/')({
	validateSearch: searchSchema,
	loaderDeps: ({ search }) => {
		return { limit: search.limit, page: search.page }
	},
	loader: ({ context, deps }) =>
		context.queryClient.ensureQueryData(projectQueries.list({ ...deps })),
	component: Home,
})

function Home() {
	const search = Route.useSearch()

	return (
		<>
			<HeroSection />
			<FilterSection />
			<ProjectListSection limit={search.limit} page={search.page} />
		</>
	)
}
