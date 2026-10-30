import { Link } from '@tanstack/react-router'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import type { ORPCRouterOutputs } from '@altstack/api/routers'

import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@altstack/ui/components/card'
import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from '@altstack/ui/components/chart'

import { AdminEmpty } from '#/features/admin-dashboard/components/dashboard-state'

type Overview = ORPCRouterOutputs['admin']['dashboard']['overview']
const config = { count: { label: 'Projects', color: 'var(--primary)' } }
const labels = {
	published: 'Published',
	draft: 'Draft',
	rejected: 'Rejected',
	removed: 'Removed',
}
const number = new Intl.NumberFormat('en-US')

export function ProjectStatusChart({
	statuses,
	counts,
}: {
	statuses: Overview['statuses']
	counts: Overview['counts']
}) {
	const distribution = statuses.map((item) => {
		return { ...item, label: labels[item.status] }
	})
	return (
		<Card className="min-w-0">
			<CardHeader>
				<CardTitle>
					<h2>Catalog at a glance</h2>
				</CardTitle>
				<CardDescription>
					Current project distribution by status
				</CardDescription>
			</CardHeader>
			<CardContent className="flex min-w-0 flex-col gap-5">
				<div className="flex flex-col gap-1">
					<Link
						to="/projects"
						search={{ status: 'published' }}
						aria-label={`Published projects: ${number.format(counts.published)}`}
						className="w-fit rounded-sm text-3xl font-semibold tracking-tight tabular-nums underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
					>
						{number.format(counts.published)}
					</Link>
					<p className="text-xs text-muted-foreground">
						Published projects live in the catalog
					</p>
				</div>
				<dl className="grid grid-cols-2 gap-4 border-y py-3">
					<div className="flex min-w-0 flex-col gap-1">
						<dt className="text-xs text-muted-foreground">Total projects</dt>
						<dd>
							<Link
								to="/projects"
								aria-label={`Total projects: ${number.format(counts.totalProjects)}`}
								className="rounded-sm text-sm font-medium tabular-nums underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
							>
								{number.format(counts.totalProjects)}
							</Link>
						</dd>
					</div>
					<div className="flex min-w-0 flex-col gap-1">
						<dt className="text-xs text-muted-foreground">Accounts</dt>
						<dd>
							<Link
								to="/admin/users"
								aria-label={`Accounts: ${number.format(counts.users)}`}
								className="rounded-sm text-sm font-medium tabular-nums underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
							>
								{number.format(counts.users)}
							</Link>
						</dd>
					</div>
				</dl>
				{statuses.some((item) => item.count > 0) ? (
					<ChartContainer
						config={config}
						className="h-40 min-h-40 w-full"
						aria-label="Project status distribution"
					>
						<BarChart
							accessibilityLayer
							data={distribution}
							layout="vertical"
							margin={{ left: 0, right: 8, top: 0, bottom: 0 }}
						>
							<CartesianGrid horizontal={false} />
							<XAxis
								type="number"
								allowDecimals={false}
								tickLine={false}
								axisLine={false}
								fontSize={11}
								tick={{ fill: 'var(--muted-foreground)' }}
							/>
							<YAxis
								type="category"
								dataKey="label"
								width={72}
								tickLine={false}
								axisLine={false}
								fontSize={11}
								tick={{ fill: 'var(--muted-foreground)' }}
							/>
							<ChartTooltip content={<ChartTooltipContent />} />
							<Bar
								dataKey="count"
								fill="var(--color-count)"
								radius={[0, 4, 4, 0]}
								maxBarSize={18}
								isAnimationActive={false}
							/>
						</BarChart>
					</ChartContainer>
				) : (
					<AdminEmpty
						title="No projects yet"
						description="Create a project to start building the catalog."
					/>
				)}
			</CardContent>
			<CardFooter className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
				{statuses.map((item) => (
					<Link
						key={item.status}
						to="/projects"
						search={{ status: item.status }}
						className="flex min-w-0 items-center justify-between gap-2 rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
					>
						<span>{labels[item.status]}</span>
						<span className="text-muted-foreground tabular-nums">
							{number.format(item.count)}
						</span>
					</Link>
				))}
			</CardFooter>
		</Card>
	)
}
