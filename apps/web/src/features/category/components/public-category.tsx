import { Link, useRouter } from '@tanstack/react-router'
import { Fragment } from 'react'

import type { CategoryNode } from '@altstack/shared/schemas/category'

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

export function CategoryBreadcrumb({
	ancestors = [],
	category,
}: {
	ancestors?: Array<CategoryNode>
	category?: CategoryNode
}) {
	return (
		<Breadcrumb>
			<BreadcrumbList>
				<BreadcrumbItem>
					<BreadcrumbLink render={<Link to="/" />}>Home</BreadcrumbLink>
				</BreadcrumbItem>
				<BreadcrumbSeparator />
				<BreadcrumbItem>
					{category ? (
						<BreadcrumbLink render={<Link to="/categories" />}>
							Categories
						</BreadcrumbLink>
					) : (
						<BreadcrumbPage>Categories</BreadcrumbPage>
					)}
				</BreadcrumbItem>
				{ancestors.map((ancestor) => (
					<Fragment key={ancestor.id}>
						<BreadcrumbSeparator />
						<BreadcrumbItem>
							<BreadcrumbLink
								render={
									<Link to="/categories/$" params={{ _splat: ancestor.path }} />
								}
							>
								{ancestor.name}
							</BreadcrumbLink>
						</BreadcrumbItem>
					</Fragment>
				))}
				{category && (
					<>
						<BreadcrumbSeparator />
						<BreadcrumbItem>
							<BreadcrumbPage>{category.name}</BreadcrumbPage>
						</BreadcrumbItem>
					</>
				)}
			</BreadcrumbList>
		</Breadcrumb>
	)
}

export function CategoryLinks({
	categories,
}: {
	categories: Array<CategoryNode>
}) {
	return categories.map((category) => (
		<Badge
			key={category.id}
			variant="secondary"
			className="h-auto min-h-6 max-w-full py-1 whitespace-normal"
			render={<Link to="/categories/$" params={{ _splat: category.path }} />}
		>
			{category.name}
		</Badge>
	))
}

export function PublicProjectCategories({
	categories,
}: {
	categories: Array<CategoryNode>
}) {
	if (categories.length === 0) return null
	return (
		<section aria-labelledby="project-categories-heading" className="space-y-3">
			<h2 id="project-categories-heading" className="text-lg font-medium">
				Categories
			</h2>
			<div className="flex flex-wrap gap-2">
				<CategoryLinks categories={categories} />
			</div>
		</section>
	)
}

export function CategoriesPending() {
	return (
		<output className="container mx-auto block max-w-6xl px-4 pt-28 lg:px-16">
			Loading categories…
		</output>
	)
}

export function CategoryNotFound() {
	return (
		<div className="container mx-auto max-w-6xl space-y-4 px-4 pt-28 lg:px-16">
			<h1 className="text-3xl font-medium">Category not found</h1>
			<p className="text-muted-foreground">
				This category address does not exist.
			</p>
			<Link to="/categories" className="underline underline-offset-4">
				Browse categories
			</Link>
		</div>
	)
}

export function CategoriesError() {
	const router = useRouter()
	return (
		<div
			role="alert"
			className="container mx-auto max-w-6xl space-y-4 px-4 pt-28 lg:px-16"
		>
			<h1 className="text-3xl font-medium">Unable to load categories</h1>
			<p className="text-muted-foreground">Please try again in a moment.</p>
			<Button onClick={() => void router.invalidate()}>Try again</Button>
		</div>
	)
}
