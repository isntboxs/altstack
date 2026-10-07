import { IconArrowRight } from '@tabler/icons-react'
import { createFileRoute, Link } from '@tanstack/react-router'

import {
	CategoriesError,
	CategoriesPending,
	CategoryBreadcrumb,
} from '#/features/category/components/public-category'
import { categoriesIntro, categoryHead } from '#/features/category/meta'
import { categoryQueries } from '#/features/category/queries'

export const Route = createFileRoute('/_app/categories/')({
	loader: ({ context }) => context.queryClient.query(categoryQueries.list()),
	head: () => categoryHead(),
	pendingComponent: CategoriesPending,
	errorComponent: CategoriesError,
	component: CategoriesIndex,
})

function CategoriesIndex() {
	const { categories } = Route.useLoaderData()
	// oxlint-disable-next-line unicorn/no-array-sort -- Sort a copy for ES2022 browser support.
	const ordered = [...categories].sort(
		(a, b) => a.name.localeCompare(b.name) || a.path.localeCompare(b.path)
	)
	const roots = ordered.filter((category) => category.parentId === null)
	return (
		<div className="container mx-auto w-full max-w-6xl space-y-10 px-4 pt-28 pb-10 lg:px-16">
			<div className="space-y-4">
				<CategoryBreadcrumb />
				<h1 className="text-3xl font-medium tracking-tight sm:text-4xl">
					Open Source Software Categories
				</h1>
				<p className="max-w-3xl text-lg leading-7 text-muted-foreground">
					{categoriesIntro}
				</p>
			</div>
			{roots.length === 0 ? (
				<div className="rounded-xl border border-dashed border-border p-8 text-center">
					<p className="text-lg font-medium">No categories to explore yet</p>
					<p className="mt-2 text-muted-foreground">
						Categories will appear here when they have published projects.
					</p>
					<Link
						to="/"
						className="mt-4 inline-block underline underline-offset-4"
					>
						Browse projects
					</Link>
				</div>
			) : (
				<div className="grid grid-cols-1 gap-x-8 gap-y-10 lg:grid-cols-3">
					{roots.map((root) => (
						<section key={root.id} aria-label={root.name} className="space-y-3">
							<h2 className="text-lg font-medium">
								<Link
									to="/categories/$"
									params={{ _splat: root.path }}
									className="underline-offset-4 hover:underline"
								>
									{root.name}
								</Link>
							</h2>
							<ul className="space-y-2">
								{ordered
									.filter((child) => child.parentId === root.id)
									.map((child) => (
										<li key={child.id}>
											<Link
												to="/categories/$"
												params={{ _splat: child.path }}
												className="flex items-start gap-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
											>
												<IconArrowRight
													aria-hidden="true"
													className="mt-0.5 size-4 shrink-0"
												/>
												{child.name}
											</Link>
										</li>
									))}
							</ul>
						</section>
					))}
				</div>
			)}
		</div>
	)
}
