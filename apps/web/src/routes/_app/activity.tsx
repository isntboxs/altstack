import {
	IconCode,
	IconDots,
	IconGitCommit,
	IconGitMerge,
	IconHome,
} from '@tabler/icons-react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { formatDate } from 'date-fns'

import type { ORPCRouterOutputs } from '@altstack/api/routers'

import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from '@altstack/ui/components/avatar'
import { Badge } from '@altstack/ui/components/badge'
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from '@altstack/ui/components/breadcrumb'
import { Button } from '@altstack/ui/components/button'
import { ButtonGroup } from '@altstack/ui/components/button-group'
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@altstack/ui/components/card'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@altstack/ui/components/dropdown-menu'
import { cn } from '@altstack/ui/lib/utils'

import { orpc } from '#/utils/orpc'

const REPO_URL = 'https://github.com/isntboxs/altstack'
const TREE_URL = `${REPO_URL}/tree/`

export const Route = createFileRoute('/_app/activity')({
	component: RouteComponent,
	loader: ({ context }) =>
		context.queryClient.prefetchQuery(
			context.orpc.altstack.listCommits.queryOptions()
		),
})

function RouteComponent() {
	return (
		<div className="container mx-auto w-full max-w-6xl px-6 pt-36 pb-10 lg:px-16">
			<Breadcrumb>
				<BreadcrumbList>
					<BreadcrumbItem>
						<BreadcrumbLink render={<Link to="/" viewTransition />}>
							<IconHome className="size-4" />
						</BreadcrumbLink>
					</BreadcrumbItem>

					<BreadcrumbSeparator />

					<BreadcrumbItem>
						<BreadcrumbPage className="text-sm">Activity</BreadcrumbPage>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>

			<div className="mt-4 space-y-2">
				<h1 className="text-3xl font-medium">Last Commits</h1>

				<p className="text-base text-muted-foreground">
					Recent commits and contributions to the project.
				</p>
			</div>

			<CommitList />
		</div>
	)
}

const CommitList = () => {
	const query = useSuspenseQuery(orpc.altstack.listCommits.queryOptions())

	return (
		<ul className="mt-6">
			{query.data.map((commit, index) => (
				<CommitItem
					key={commit.sha}
					commit={commit}
					isLast={index === query.data.length - 1}
				/>
			))}
		</ul>
	)
}

const CommitItem = ({
	commit,
	isLast,
}: {
	commit: ORPCRouterOutputs['altstack']['listCommits'][number]
	isLast: boolean
}) => {
	const isMerge = commit.parents.length > 1

	return (
		<li className="relative space-y-2">
			<div className="flex items-center gap-4">
				<div className="flex size-6 items-center justify-center rounded-md bg-card p-0.5 ring-1 ring-border">
					{isMerge ? <IconGitMerge /> : <IconGitCommit />}
				</div>

				{commit.author.date && (
					<p className="text-xs text-muted-foreground">
						Commit on {formatDate(new Date(commit.author.date), 'MMM dd, yyyy')}
					</p>
				)}
			</div>

			<div
				className={cn(
					'absolute top-6 left-[0.69rem] w-0.5 bg-border',
					isLast ? '-bottom-2' : '-bottom-6'
				)}
			/>

			<Card className="mb-4 ml-10">
				<CardHeader className="flex items-center justify-between gap-2">
					<CardTitle className="truncate text-sm font-medium">
						<a href={commit.htmlUrl} target="_blank" rel="noopener noreferrer">
							{commit.message.split('\n')[0]}
						</a>
					</CardTitle>

					{isMerge && (
						<Badge variant="secondary" className="ml-auto">
							<IconGitMerge /> <span className="max-lg:hidden">merged</span>
						</Badge>
					)}

					<ButtonGroup>
						<ButtonGroup className="max-lg:hidden">
							<Button
								render={
									<a
										href={commit.htmlUrl}
										target="_blank"
										rel="noopener noreferrer"
										aria-label={`View Commit ${commit.sha.slice(0, 7)}`}
									/>
								}
								variant="outline"
								size="xs"
								nativeButton={false}
							>
								{commit.sha.slice(0, 7)}
							</Button>

							<Button
								render={
									<a
										href={`${TREE_URL}${commit.sha}`}
										target="_blank"
										rel="noopener noreferrer"
										aria-label={`Browse Repository at ${commit.sha.slice(0, 7)}`}
									/>
								}
								variant="outline"
								size="icon-xs"
								nativeButton={false}
							>
								<IconCode />
							</Button>
						</ButtonGroup>

						<ButtonGroup className="lg:hidden">
							<DropdownMenu>
								<DropdownMenuTrigger
									render={
										<Button
											variant="outline"
											size="icon-xs"
											aria-label="More options"
										>
											<IconDots />
										</Button>
									}
								/>

								<DropdownMenuContent align="end" className="w-50">
									<DropdownMenuGroup>
										<DropdownMenuItem
											render={
												<a
													href={commit.htmlUrl}
													target="_blank"
													rel="noopener noreferrer"
													aria-label={`View Commit ${commit.sha.slice(0, 7)}`}
												/>
											}
										>
											<IconGitCommit /> View Commit
										</DropdownMenuItem>

										<DropdownMenuItem
											render={
												<a
													href={commit.htmlUrl}
													target="_blank"
													rel="noopener noreferrer"
													aria-label={`Browse Repository at ${commit.sha.slice(0, 7)}`}
												/>
											}
										>
											<IconCode /> Browse Repository
										</DropdownMenuItem>
									</DropdownMenuGroup>
								</DropdownMenuContent>
							</DropdownMenu>
						</ButtonGroup>
					</ButtonGroup>
				</CardHeader>

				{commit.message.split('\n').length > 1 && (
					<CardContent>
						{commit.message.split('\n').map((line, index) => {
							if (index === 0) return null

							return (
								<p key={index} className="text-sm text-muted-foreground">
									{line}
								</p>
							)
						})}
					</CardContent>
				)}

				<CardFooter>
					<Avatar size="sm" className="rounded-md!">
						<AvatarImage
							src={commit.author.avatarUrl ?? ''}
							alt={commit.author.name ?? ''}
							className="rounded-md!"
						/>
						<AvatarFallback className="rounded-md!">
							{commit.author.name?.at(0)?.toUpperCase() ?? 'U'}
						</AvatarFallback>
					</Avatar>

					<p className="ml-2 text-sm text-muted-foreground">
						<span className="font-semibold text-primary lowercase">
							{commit.author.name}
						</span>{' '}
						commited
					</p>
				</CardFooter>
			</Card>
		</li>
	)
}
