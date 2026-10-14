import type { ORPCRouterOutputs } from '@altstack/api/routers'

import { projectImage, publicUrl, seoHead } from './meta'

export function projectHead(
	project: ORPCRouterOutputs['project']['getBySlug']
) {
	const path = `/${encodeURIComponent(project.slug)}`
	const description =
		project.description ||
		project.tagline ||
		`${project.name} — open-source software on AltStack.`
	return seoHead({
		title: `${project.name}${project.tagline ? ` — ${project.tagline}` : ''} | AltStack`,
		description,
		path,
		image: projectImage(
			project.id,
			project.updatedAt,
			project.github.fetchedAt
		),
		imageAlt: `${project.name} on AltStack${project.tagline ? ` — ${project.tagline}` : ''}`,
		entities: [
			{
				'@type': 'SoftwareSourceCode',
				'@id': publicUrl(`${path}#software`),
				name: project.name,
				description,
				url: publicUrl(path),
				codeRepository: project.repositoryUrl,
				...(project.websiteUrl ? { sameAs: project.websiteUrl } : {}),
				dateModified: new Date(project.updatedAt).toISOString(),
				keywords: project.categoryDetails.map((category) => category.name),
				mainEntityOfPage: publicUrl(path),
			},
		],
	})
}
