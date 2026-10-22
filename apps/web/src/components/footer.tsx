import { useQuery } from '@tanstack/react-query'
import { Link, linkOptions } from '@tanstack/react-router'

import { env } from '@altstack/env/web'

import { Separator } from '@altstack/ui/components/separator'

import { BrandMark } from '#/components/brand-mark'
import { ThemeSwitcher } from '#/components/theme-switcher'
import { categoryQueries } from '#/features/category/queries'

const repositoryUrl = 'https://github.com/isntboxs/altstack'
const copyrightYear = new Date().getUTCFullYear()
const linkClassName =
	'w-fit rounded-sm text-sm text-muted-foreground transition-colors outline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring'

const exploreLinks = linkOptions([
	{ label: 'All Projects', to: '/', search: {}, hash: 'catalogue' },
	{ label: 'Categories', to: '/categories', search: {} },
	{ label: 'Tags', to: '/tags', search: {} },
	{
		label: 'Latest Projects',
		to: '/',
		search: { sort: 'newest' },
		hash: 'catalogue',
	},
	{
		label: 'Most Starred',
		to: '/',
		search: { sort: 'most-stars' },
		hash: 'catalogue',
	},
])

const communityLinks = linkOptions([
	{ label: 'Submit a Project', to: '/submit', search: {} },
	{ label: 'Project Activity', to: '/activity', search: {} },
])

export function Footer() {
	return (
		<footer className="mt-16" aria-label="Site footer">
			<div className="container mx-auto w-full max-w-6xl px-6 lg:px-16">
				<Separator />

				<div className="grid gap-10 py-10 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] md:gap-16">
					<div className="flex flex-col gap-4">
						<Link
							to="/"
							search={{}}
							className="flex w-fit items-center gap-2 rounded-sm font-medium lowercase outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
						>
							<BrandMark />
							{env.VITE_APP_NAME}
						</Link>
						<p className="max-w-72 text-sm leading-6 text-pretty text-muted-foreground">
							Discover open-source software you'll actually use.
						</p>
					</div>

					<div className="grid grid-cols-2 gap-8">
						<nav aria-label="Footer Explore" className="flex flex-col gap-4">
							<h2 className="text-sm font-medium">Explore</h2>
							<ul className="flex flex-col gap-3">
								{exploreLinks.map(({ label, ...options }) => (
									<li key={label}>
										<Link {...options} className={linkClassName}>
											{label}
										</Link>
									</li>
								))}
							</ul>
						</nav>

						<nav aria-label="Footer Community" className="flex flex-col gap-4">
							<h2 className="text-sm font-medium">Community</h2>
							<ul className="flex flex-col gap-3">
								{communityLinks.map(({ label, ...options }) => (
									<li key={label}>
										<Link {...options} className={linkClassName}>
											{label}
										</Link>
									</li>
								))}
								{[
									{ label: 'GitHub', href: repositoryUrl },
									{
										label: 'Report an Issue',
										href: `${repositoryUrl}/issues/new`,
									},
								].map(({ label, href }) => (
									<li key={label}>
										<a
											href={href}
											target="_blank"
											rel="noopener noreferrer"
											className={linkClassName}
										>
											{label}
											<span className="sr-only"> (opens in a new tab)</span>
										</a>
									</li>
								))}
							</ul>
						</nav>
					</div>
				</div>

				<div className="flex flex-col gap-4 pb-10 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
					<p>
						© {copyrightYear} {env.VITE_APP_NAME}
					</p>
					<div className="flex items-center gap-4">
						<p>
							Made by{' '}
							<a
								href="https://x.com/isntboxs"
								target="_blank"
								rel="noopener noreferrer"
								className="rounded-sm text-foreground underline-offset-4 outline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
							>
								mrboxs
								<span className="sr-only"> (opens in a new tab)</span>
							</a>
						</p>
						<ThemeSwitcher />
					</div>
				</div>

				<FooterCategories />
			</div>
		</footer>
	)
}

function FooterCategories() {
	const { data } = useQuery({
		...categoryQueries.list(),
		staleTime: 5 * 60 * 1000,
		retry: false,
	})
	const categories = (data?.categories ?? [])
		.filter((category) => category.isLeaf && category.projectCount > 0)
		// Sort a filtered copy for ES2022 browser support.
		// oxlint-disable-next-line unicorn/no-array-sort
		.sort(
			(a, b) =>
				b.projectCount - a.projectCount ||
				a.name.localeCompare(b.name, 'en') ||
				a.path.localeCompare(b.path, 'en')
		)
		.slice(0, 9)
	if (categories.length === 0) return null

	return (
		<>
			<Separator />
			<nav
				aria-label="Browse by category"
				className="flex flex-col gap-5 py-10"
			>
				<h2 className="text-sm font-medium">Browse by Category</h2>
				<ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
					{categories.map((category) => (
						<li key={category.id} className="min-w-0">
							<Link
								to="/categories/$"
								params={{ _splat: category.path }}
								search={{}}
								className="flex items-center gap-3 rounded-sm text-sm text-muted-foreground outline-offset-4 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
							>
								<span className="truncate" title={category.name}>
									{category.name}
								</span>
								<Separator aria-hidden="true" className="min-w-4 flex-1" />
								<span className="shrink-0 text-xs tabular-nums">
									{category.projectCount.toLocaleString('en-US')}
									<span className="sr-only">
										{' '}
										{category.projectCount === 1 ? 'project' : 'projects'}
									</span>
								</span>
							</Link>
						</li>
					))}
				</ul>
			</nav>
		</>
	)
}
