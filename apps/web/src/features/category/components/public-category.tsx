import { Link } from '@tanstack/react-router'
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
import { Skeleton } from '@altstack/ui/components/skeleton'

import { PublicError } from '#/components/public-page-state'
import { LoadingStatus } from '#/components/public-skeletons'
import { categoriesIntro } from '#/features/category/meta'

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
				<BreadcrumbItem className="min-w-0 wrap-anywhere">
					<BreadcrumbLink render={<Link to="/" />}>Home</BreadcrumbLink>
				</BreadcrumbItem>
				<BreadcrumbSeparator />
				<BreadcrumbItem className="min-w-0 wrap-anywhere">
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
						<BreadcrumbItem className="min-w-0 wrap-anywhere">
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
						<BreadcrumbItem className="min-w-0 wrap-anywhere">
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
			className="h-auto min-h-9 max-w-full py-1 wrap-anywhere whitespace-normal"
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
		<div
			data-skeleton="categories-directory"
			aria-busy="true"
			className="container mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pt-28 pb-10 lg:px-16"
		>
			<LoadingStatus>Loading categories…</LoadingStatus>
			<div className="flex flex-col gap-4">
				<CategoryBreadcrumb />
				<h1 className="text-3xl font-medium tracking-tight wrap-anywhere sm:text-4xl">
					Open Source Software Categories
				</h1>
				<p className="max-w-3xl text-lg leading-7 text-muted-foreground">
					{categoriesIntro}
				</p>
			</div>
			<div
				aria-hidden="true"
				className="grid grid-cols-1 gap-x-8 gap-y-10 lg:grid-cols-3"
			>
				{[0, 1, 2].map((key) => (
					<div key={key} className="flex min-w-0 flex-col gap-3">
						<Skeleton className="h-7 w-2/3" />
						<div className="flex flex-col gap-2">
							{[0, 1, 2].map((item) => (
								<Skeleton key={item} className="h-7 w-full" />
							))}
						</div>
					</div>
				))}
			</div>
		</div>
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
	return <PublicError title="Unable to load categories" />
}
