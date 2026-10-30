import { useSuspenseQuery } from '@tanstack/react-query'

import { Badge } from '@altstack/ui/components/badge'

import { QueryBoundary } from '#/components/query-boundary'
import { adminCategoryQueries } from '#/features/admin-categories/queries'

export function ProjectCategoryBadges({ slugs }: { slugs: Array<string> }) {
	const fallback = <CategoryBadges slugs={slugs} />
	if (slugs.length === 0) return fallback
	return (
		<QueryBoundary pending={fallback} error={() => fallback}>
			<CategoryNames slugs={slugs} />
		</QueryBoundary>
	)
}

function CategoryNames({ slugs }: { slugs: Array<string> }) {
	const { data } = useSuspenseQuery(adminCategoryQueries.list())
	return <CategoryBadges slugs={slugs} categories={data.categories} />
}

function CategoryBadges({
	slugs,
	categories = [],
}: {
	slugs: Array<string>
	categories?: Array<{ slug: string; name: string }>
}) {
	return slugs.length > 0 ? (
		slugs.map((slug) => (
			<Badge key={slug} variant="outline">
				{categories.find((category) => category.slug === slug)?.name ?? slug}
			</Badge>
		))
	) : (
		<p className="text-xs text-muted-foreground">No categories selected.</p>
	)
}
