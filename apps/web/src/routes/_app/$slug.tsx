import { cjk } from '@streamdown/cjk'
import { code } from '@streamdown/code'
import { math } from '@streamdown/math'
import { mermaid } from '@streamdown/mermaid'
import {
	IconBrandGithub,
	IconCalendar,
	IconGitBranch,
	IconGitCommit,
	IconGitFork,
	IconTag,
} from '@tabler/icons-react'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'
import {
	Bookmark,
	Code,
	Flag,
	More,
	SquareBottomUp,
	Star,
	Verified,
} from 'reicon-react'
import { Streamdown } from 'streamdown'
import 'streamdown/styles.css'

import type { ORPCRouterOutputs } from '@altstack/api/routers'

import { Button } from '@altstack/ui/components/button'
import { ButtonGroup } from '@altstack/ui/components/button-group'
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from '@altstack/ui/components/card'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@altstack/ui/components/dropdown-menu'
import { Separator } from '@altstack/ui/components/separator'
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from '@altstack/ui/components/tooltip'

import { projectQueries, useProjectBySlug } from '#/features/project/queries'

export const Route = createFileRoute('/_app/$slug')({
	loader: async ({ context, params }) => {
		await context.queryClient.ensureQueryData(
			projectQueries.bySlug(params.slug)
		)
	},
	component: RouteComponent,
})

const MoreActions = ({ websiteUrl }: { websiteUrl: string | null }) => (
	<div className="flex items-center gap-2">
		{websiteUrl && (
			<Button
				render={
					<a href={websiteUrl} target="_blank">
						Visit <SquareBottomUp />
					</a>
				}
				nativeButton={false}
			/>
		)}

		<div className="xl:hidden">
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button variant="outline" className="max-lg:size-8">
							<More />
							<span className="max-lg:hidden">More</span>
						</Button>
					}
				/>

				<DropdownMenuContent align="end">
					<DropdownMenuGroup>
						<DropdownMenuItem>
							<Verified /> Verify
						</DropdownMenuItem>
					</DropdownMenuGroup>

					<DropdownMenuSeparator />

					<DropdownMenuGroup>
						<DropdownMenuItem>
							<Bookmark /> Bookmark
						</DropdownMenuItem>

						<DropdownMenuItem>
							<Flag /> Report
						</DropdownMenuItem>

						<DropdownMenuItem>
							<Code /> Embed
						</DropdownMenuItem>
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>

		<div className="flex items-center gap-2 max-xl:hidden">
			<Tooltip>
				<TooltipTrigger
					render={
						<Button variant="outline">
							<Verified /> Verify
						</Button>
					}
				/>
				<TooltipContent>
					Verify ownership to earn a trusted badge and rank higher in listings
				</TooltipContent>
			</Tooltip>

			<ButtonGroup>
				<Tooltip>
					<TooltipTrigger
						render={
							<Button variant="outline">
								<Bookmark /> Bookmark
							</Button>
						}
					/>
					<TooltipContent>Bookmark</TooltipContent>
				</Tooltip>

				<Tooltip>
					<TooltipTrigger
						render={
							<Button variant="outline" size="icon">
								<Flag />
							</Button>
						}
					/>
					<TooltipContent>Send a report/suggestion</TooltipContent>
				</Tooltip>

				<Tooltip>
					<TooltipTrigger
						render={
							<Button variant="outline" size="icon">
								<Code />
							</Button>
						}
					/>
					<TooltipContent>Embed on your website</TooltipContent>
				</Tooltip>
			</ButtonGroup>
		</div>
	</div>
)

const AsideSection = ({
	github,
}: {
	github: ORPCRouterOutputs['project']['getBySlug']['github']
}) => {
	// FIXME(#32): wire real GitHub metadata for remaining stats (R5 refresh) — stars/forks is R1 scope, other fields intentionally Unknown for now.
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
			value: 'Unknown',
		},
		{
			icon: IconCalendar,
			label: 'Repository age',
			value: 'Unknown',
		},
		{
			icon: IconTag,
			label: 'Version',
			value: 'Unknown',
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
								title={String(item.value)}
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
				</CardContent>
			</Card>
		</div>
	)
}

function RouteComponent() {
	const { slug } = Route.useParams()
	const { data: projectData } = useProjectBySlug(slug)

	const safeWebsiteUrl = useMemo(() => {
		try {
			if (!projectData.websiteUrl) return null
			const u = new URL(projectData.websiteUrl)
			return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null
		} catch {
			return null
		}
	}, [projectData.websiteUrl])

	return (
		<div className="container mx-auto w-full max-w-6xl px-6 pt-32 pb-10 lg:px-16">
			<div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
				<div className="space-y-8">
					<div className="sticky top-12 z-50 flex items-center justify-between py-4">
						<div className="flex items-center gap-2">
							<img
								src={projectData.logo}
								alt={projectData.name}
								className="size-8 rounded-md"
							/>

							<h1 className="text-3xl font-medium">{projectData.name}</h1>

							<div className="pointer-events-none absolute inset-0 top-0 -z-10 h-full bg-linear-to-b from-background via-background via-85% to-transparent" />
						</div>

						<MoreActions websiteUrl={safeWebsiteUrl} />
					</div>

					<div className="-mt-8 space-y-8">
						<p className="text-lg leading-7 text-muted-foreground">
							{projectData.description}
						</p>

						<div className="flex items-center gap-4">
							<Button
								variant="outline"
								size="lg"
								render={
									<a href={projectData.repositoryUrl} target="_blank">
										<IconBrandGithub /> Visit GitHub
									</a>
								}
								nativeButton={false}
							/>

							{safeWebsiteUrl && (
								<Button
									size="lg"
									render={
										<a href={safeWebsiteUrl} target="_blank">
											Visit Website <SquareBottomUp />
										</a>
									}
									nativeButton={false}
								/>
							)}
						</div>
					</div>

					{safeWebsiteUrl && (
						<a
							href={safeWebsiteUrl}
							target="_blank"
							className="group/screenshot block h-fit overflow-hidden rounded-lg"
						>
							{/* TODO(#32): replace static placeholder with real website screenshot/OG image when available — R1 intentionally uses placeholder + safeWebsiteUrl is already non-fatal (useMemo new URL guard). */}
							<img
								src="https://placehold.co/1280x1024"
								className="aspect-video h-auto object-cover transition-transform duration-300 ease-in-out group-hover/screenshot:scale-105"
								alt={`Screenshot of ${projectData.name} website`}
							/>
						</a>
					)}

					{projectData.content && (
						<Streamdown
							mode="static"
							plugins={{
								code: code,
								mermaid: mermaid,
								math: math,
								cjk: cjk,
							}}
						>
							{projectData.content}
						</Streamdown>
					)}
				</div>

				<AsideSection github={projectData.github} />
			</div>
		</div>
	)
}
