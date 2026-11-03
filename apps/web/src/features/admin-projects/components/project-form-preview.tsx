import { IconBrandGithub, IconPhoto } from '@tabler/icons-react'

import { Card, CardContent } from '@altstack/ui/components/card'

import { ProjectCategoryBadges } from '#/components/project-category-badges'

type ProjectPreviewValues = {
	name?: string
	slug?: string
	tagline?: string | null
	description?: string | null
	repositoryUrl?: string
	categorySlugs?: Array<string>
}

function previewText(values: ProjectPreviewValues) {
	const name = (values.name ?? '').trim() || 'Untitled project'
	const slug = (values.slug ?? '').trim() || 'your-slug'
	const tagline = (values.tagline ?? '').trim()
	const description = (values.description ?? '').trim()
	const repository = (values.repositoryUrl ?? '').trim()
	return { name, slug, tagline, description, repository }
}

export function SectionHeading({
	title,
	description,
}: {
	title: string
	description?: string
}) {
	return (
		<div className="space-y-1">
			<h2 className="text-sm font-semibold">{title}</h2>
			{description ? (
				<p className="text-sm text-muted-foreground">{description}</p>
			) : null}
		</div>
	)
}

export function ProjectPreviewCard({
	values,
	logoUrl,
	screenshotUrl,
}: {
	values: ProjectPreviewValues
	logoUrl: string | null
	screenshotUrl: string | null
}) {
	const { name, slug, tagline, description, repository } = previewText(values)

	return (
		<Card className="overflow-hidden">
			<CardContent className="space-y-4">
				<div className="flex items-center gap-3">
					{logoUrl ? (
						<img
							src={logoUrl}
							alt=""
							className="size-10 shrink-0 rounded-md border object-cover"
						/>
					) : (
						<div
							aria-hidden="true"
							className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-semibold text-muted-foreground"
						>
							{name.charAt(0).toUpperCase()}
						</div>
					)}

					<div className="min-w-0">
						<p className="truncate text-sm font-semibold">{name}</p>
						<p className="truncate font-mono text-xs text-muted-foreground">
							/{slug}
						</p>
					</div>
				</div>

				{screenshotUrl ? (
					<img
						src={screenshotUrl}
						alt=""
						className="aspect-video w-full rounded-md border object-cover"
					/>
				) : (
					<div className="flex aspect-video w-full flex-col items-center justify-center gap-1.5 rounded-md border border-dashed text-muted-foreground">
						<IconPhoto className="size-5" />
						<p className="text-xs">16:9 screenshot preview</p>
					</div>
				)}

				<div className="space-y-1">
					<p className={tagline ? 'text-sm' : 'text-sm text-muted-foreground'}>
						{tagline || 'Tagline will appear here.'}
					</p>
					<p
						className={
							description
								? 'line-clamp-3 text-sm text-muted-foreground'
								: 'text-sm text-muted-foreground/60'
						}
					>
						{description || 'Short description will appear here.'}
					</p>
				</div>

				<div className="flex flex-wrap gap-1.5">
					<ProjectCategoryBadges slugs={values.categorySlugs ?? []} />
				</div>

				<div className="flex items-center gap-1.5 border-t pt-3 text-xs text-muted-foreground">
					<IconBrandGithub className="size-3.5 shrink-0" />
					<span className="truncate font-mono">
						{repository
							? `github.com/${repository}`
							: 'github.com/owner/repository'}
					</span>
				</div>
			</CardContent>
		</Card>
	)
}
