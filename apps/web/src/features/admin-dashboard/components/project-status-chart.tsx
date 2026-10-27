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

const config = { count: { label: 'Projects', color: 'var(--chart-1)' } }
export function ProjectStatusChart({
	statuses,
}: {
	statuses: ORPCRouterOutputs['admin']['dashboard']['overview']['statuses']
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Catalog at a glance</CardTitle>
				<CardDescription>
					Current project distribution by status
				</CardDescription>
			</CardHeader>
			<CardContent>
				{statuses.some((item) => item.count > 0) ? (
					<ChartContainer
						config={config}
						className="h-52 min-h-48 w-full"
						aria-label="Project status distribution"
					>
						<BarChart accessibilityLayer data={statuses}>
							<CartesianGrid vertical={false} />
							<XAxis dataKey="status" tickLine={false} axisLine={false} />
							<YAxis
								allowDecimals={false}
								width={36}
								tickLine={false}
								axisLine={false}
							/>
							<ChartTooltip content={<ChartTooltipContent />} />
							<Bar
								dataKey="count"
								fill="var(--color-count)"
								radius={4}
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
			<CardFooter className="flex flex-wrap gap-3 text-xs">
				{statuses.map((item) => (
					<Link
						key={item.status}
						to="/projects"
						search={{ status: item.status }}
						className="underline underline-offset-4"
					>
						{item.status}: {item.count.toLocaleString()}
					</Link>
				))}
			</CardFooter>
		</Card>
	)
}
