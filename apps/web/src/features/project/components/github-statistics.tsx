import {
	IconCalendar,
	IconGitBranch,
	IconGitCommit,
	IconGitFork,
	IconTag,
} from '@tabler/icons-react'
import { Star } from 'reicon-react'

import type { ORPCRouterOutputs } from '@altstack/api/routers'

import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from '@altstack/ui/components/card'
import { Separator } from '@altstack/ui/components/separator'

import { GithubStarsHistory } from '#/features/project/components/github-stars-history'
import { githubElapsed, githubFullDate } from '#/features/project/github-time'

export const GithubStatistics = ({
	github,
	history,
	now,
}: {
	github: ORPCRouterOutputs['project']['getBySlug']['github']
	history: ORPCRouterOutputs['project']['getBySlug']['githubStarsHistory']
	now: number
}) => {
	const known = github.metadataFetchedAt !== null
	const githubStatsItem = [
		{
			icon: IconGitFork,
			label: 'Forks',
			value: new Intl.NumberFormat('en-US', { notation: 'standard' }).format(
				github.forks
			),
		},
		{
			icon: IconGitCommit,
			label: 'Last commit',
			value: !known
				? 'Unknown'
				: github.lastCommitAt
					? githubElapsed(github.lastCommitAt, now, true)
					: 'No commits',
			title: github.lastCommitAt
				? githubFullDate(github.lastCommitAt)
				: undefined,
		},
		{
			icon: IconCalendar,
			label: 'Repository age',
			value: github.repositoryCreatedAt
				? githubElapsed(github.repositoryCreatedAt, now)
				: 'Unknown',
			title: github.repositoryCreatedAt
				? githubFullDate(github.repositoryCreatedAt)
				: undefined,
		},
		{
			icon: IconTag,
			label: 'Version',
			value: !known ? 'Unknown' : (github.latestReleaseTag ?? 'No releases'),
		},
	]

	const repoFullName = `${github.owner}/${github.repo}`

	return (
		<div className="space-y-8 py-5">
			<Card className="sticky top-17 z-50">
				<CardHeader>
					<CardTitle className="flex items-center gap-1.5 font-normal">
						<Star className="size-4 shrink-0 fill-amber-500/20 text-amber-500" />
						<span className="text-xl font-semibold">
							{new Intl.NumberFormat('en-US', { notation: 'standard' }).format(
								github.stars
							)}
						</span>
						<span className="text-sm">Stars</span>
					</CardTitle>
				</CardHeader>

				<CardContent className="grid grid-cols-1 gap-2.5">
					<GithubStarsHistory history={history} />
					{githubStatsItem.map((item, idx) => (
						<div key={idx} className="flex items-center justify-between gap-2">
							<div className="flex shrink-0 items-center gap-1.5">
								<item.icon className="size-4 shrink-0 text-muted-foreground" />
								<span className="text-sm whitespace-nowrap text-muted-foreground">
									{item.label}
								</span>
							</div>

							<Separator className="min-w-2 flex-1" />

							<span
								className="max-w-[50%] min-w-0 truncate text-right text-sm font-medium"
								title={item.title ?? String(item.value)}
							>
								{item.value}
							</span>
						</div>
					))}

					<div className="flex items-center justify-between gap-2">
						<div className="flex shrink-0 items-center gap-1.5">
							<IconGitBranch className="size-4 shrink-0 text-muted-foreground" />
							<span className="text-sm whitespace-nowrap text-muted-foreground">
								Repository
							</span>
						</div>
						<Separator className="min-w-2 flex-1" />
						<a
							href={`https://github.com/${repoFullName}`}
							target="_blank"
							rel="noreferrer"
							title={repoFullName}
							className="max-w-[55%] min-w-0 truncate text-right text-sm font-medium underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground"
						>
							{repoFullName}
						</a>
					</div>
					<p
						className="pt-1 text-xs text-muted-foreground"
						title={githubFullDate(github.fetchedAt)}
					>
						Last refreshed {githubElapsed(github.fetchedAt, now, true)}
					</p>
					{now - github.fetchedAt.getTime() > 36 * 60 * 60 * 1000 && (
						<p className="text-xs text-amber-600 dark:text-amber-400">
							Data may be outdated
						</p>
					)}
				</CardContent>
			</Card>
		</div>
	)
}
