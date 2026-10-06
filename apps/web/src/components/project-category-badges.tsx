import { useQuery } from '@tanstack/react-query'

import { Badge } from '@altstack/ui/components/badge'

import { adminCategoryQueries } from '#/features/admin-categories/queries'

export function ProjectCategoryBadges({ slugs }: { slugs: Array<string> }) {
	const { data } = useQuery(adminCategoryQueries.list())
	return slugs.length > 0 ? (
		slugs.map((slug) => (
			<Badge key={slug} variant="outline">
				{data?.categories.find((category) => category.slug === slug)?.name ??
					slug}
			</Badge>
		))
	) : (
		<p className="text-xs text-muted-foreground">No categories selected.</p>
	)
}
