import { createFileRoute } from '@tanstack/react-router'

import { seoHead } from '#/features/seo/meta'
export const Route = createFileRoute('/_app/advertise')({
	head: () =>
		seoHead({
			title: 'Advertise on AltStack',
			description: 'Monthly sponsorship placements on AltStack.',
			path: '/advertise',
		}),
	component: () => (
		<article className="container mx-auto flex max-w-3xl flex-col gap-6 px-4 pt-28 pb-16">
			<h1 className="text-3xl font-semibold">Advertise on AltStack</h1>
			<p className="text-muted-foreground">
				Support the open-source catalogue with a monthly campaign. Campaigns are
				arranged directly with the AltStack team.
			</p>
			<h2 className="text-xl font-medium">Placements</h2>
			<ul className="list-disc pl-6">
				<li>
					Tier 1: catalogue cards, collection sidebar, and corner
					recommendation.
				</li>
				<li>
					Tier 2: all Tier 1 placements, the public banner, project sidebar, and
					homepage sponsor grid.
				</li>
				<li>Tier 3: all Tier 2 placements with twice the selection weight.</li>
			</ul>
			<p>
				Provide your name, logo, short description, website, and a horizontal
				brand wordmark. The team configures your campaign dates and call to
				action.
			</p>
			<p className="text-sm text-muted-foreground">
				Campaigns use calendar months in UTC. Placements are labeled Ad.
				Selection weights do not guarantee impressions or clicks.
			</p>
		</article>
	),
})
