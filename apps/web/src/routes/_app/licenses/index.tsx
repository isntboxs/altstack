import { createFileRoute, Link } from '@tanstack/react-router'

import {
	Empty,
	EmptyHeader,
	EmptyTitle,
	EmptyDescription,
} from '@altstack/ui/components/empty'
import { Separator } from '@altstack/ui/components/separator'

import { PublicPending } from '#/components/public-page-state'
import {
	LicenseBreadcrumb,
	LicensesError,
} from '#/features/license/components/public-license'
import { licenseQueries } from '#/features/license/queries'
import { seoHead, unavailableHead } from '#/features/seo/meta'

export const Route = createFileRoute('/_app/licenses/')({
	loader: ({ context }) => context.queryClient.query(licenseQueries.list()),
	head: ({ loaderData }) =>
		loaderData
			? seoHead({
					title: 'Open Source Software Licenses | AltStack',
					description:
						'Browse licenses used by published open source projects on AltStack.',
					path: '/licenses',
				})
			: unavailableHead(),
	pendingMs: 250,
	pendingMinMs: 200,
	pendingComponent: PublicPending,
	errorComponent: LicensesError,
	component: LicensesIndex,
})

function LicensesIndex() {
	const { licenses } = Route.useLoaderData()
	return (
		<div className="container mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pt-28 pb-10 lg:px-16">
			<div className="flex flex-col gap-4">
				<LicenseBreadcrumb />
				<h1 className="text-3xl font-medium tracking-tight wrap-anywhere sm:text-4xl">
					Browse Open Source Software Licenses
				</h1>
				<p className="max-w-3xl text-lg leading-7 text-muted-foreground">
					Discover licenses used by published projects and explore software that
					fits your needs.
				</p>
			</div>
			{licenses.length > 0 ? (
				<ul className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
					{licenses.map((license) => (
						<li key={license.slug} className="min-w-0">
							<Link
								to="/licenses/$slug"
								params={{ slug: license.slug }}
								title={license.name}
								className="group flex min-h-10 items-center gap-4 rounded-sm py-2 focus-visible:outline-2 focus-visible:outline-ring"
							>
								<span className="min-w-0 font-medium wrap-anywhere group-hover:underline">
									{license.identifier}
								</span>
								<Separator className="min-w-2 flex-1" />
								<span className="shrink-0 text-xs text-muted-foreground">
									{license.projectCount}{' '}
									{license.projectCount === 1 ? 'project' : 'projects'}
								</span>
							</Link>
						</li>
					))}
				</ul>
			) : (
				<Empty>
					<EmptyHeader>
						<EmptyTitle>No licenses to explore yet</EmptyTitle>
						<EmptyDescription>
							Licenses appear here when projects are published.
						</EmptyDescription>
					</EmptyHeader>
					<Link to="/" className="underline underline-offset-4">
						Browse projects
					</Link>
				</Empty>
			)}
			{licenses.some((license) => license.slug === 'unknown') && (
				<p className="text-sm text-muted-foreground">
					unknown means GitHub has not identified a license, including custom
					licenses and projects awaiting refresh.
				</p>
			)}
		</div>
	)
}
