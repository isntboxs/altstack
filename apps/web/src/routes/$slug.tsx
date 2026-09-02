import { cjk } from '@streamdown/cjk'
import { code } from '@streamdown/code'
import { math } from '@streamdown/math'
import { mermaid } from '@streamdown/mermaid'
import { IconBrandGithub } from '@tabler/icons-react'
import { createFileRoute, notFound } from '@tanstack/react-router'
import {
	Bookmark,
	Code,
	Flag,
	More,
	SquareBottomUp,
	Verified,
} from 'reicon-react'
import { Streamdown } from 'streamdown'
import 'streamdown/styles.css'

import { Button } from '@altstack/ui/components/button'
import { ButtonGroup } from '@altstack/ui/components/button-group'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@altstack/ui/components/dropdown-menu'
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from '@altstack/ui/components/tooltip'

import { projectQueries, useProjectBySlug } from '#/features/project/queries'

export const Route = createFileRoute('/$slug')({
	loader: async ({ context, params }) => {
		try {
			await context.queryClient.ensureQueryData(
				projectQueries.bySlug(params.slug)
			)
		} catch {
			throw notFound()
		}
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

function RouteComponent() {
	const { slug } = Route.useParams()
	const { data: projectData } = useProjectBySlug(slug)

	return (
		<div className="container mx-auto w-full max-w-6xl px-6 pt-36 pb-10 lg:px-16">
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

						<MoreActions websiteUrl={projectData.websiteUrl} />
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

							{projectData.websiteUrl && (
								<Button
									size="lg"
									render={
										<a href={projectData.websiteUrl} target="_blank">
											Visit Website <SquareBottomUp />
										</a>
									}
									nativeButton={false}
								/>
							)}
						</div>
					</div>

					{projectData.websiteUrl && (
						<a
							href={projectData.websiteUrl}
							target="_blank"
							className="group/screenshot block h-fit overflow-hidden rounded-lg"
						>
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

				<div></div>
			</div>
		</div>
	)
}
