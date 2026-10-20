import { useSearch } from '@tanstack/react-router'
import { cn } from 'cn'
import type { ReactNode } from 'react'

import { Card, CardContent, CardHeader } from '@altstack/ui/components/card'
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldTitle,
} from '@altstack/ui/components/field'
import { Skeleton } from '@altstack/ui/components/skeleton'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@altstack/ui/components/table'

import { LoadingStatus } from '#/components/public-skeletons'
import { categoryHelp } from '#/features/admin-categories/model'

type TableKind = 'bookmarks' | 'submissions' | 'projects' | 'categories'
const tableHeaders = {
	bookmarks: ['Name', 'Description', 'Action'],
	submissions: [
		'',
		'Project',
		'Repository',
		'Status',
		'Review note',
		'Submitted',
		'Actions',
	],
	projects: [
		'',
		'Name',
		'Tagline',
		'Status',
		'Submitted by',
		'Created At',
		'Updated At',
		'Actions',
	],
	categories: [
		'Name',
		'Slug',
		'Parent',
		'Depth',
		'Published projects',
		'Direct assignments',
		'Actions',
	],
}

export function TableSkeleton({
	kind,
	rows = 12,
}: {
	kind: TableKind
	rows?: number
}) {
	return (
		<div aria-hidden="true" className="overflow-hidden rounded-md border">
			<Table
				className={cn(
					kind === 'submissions' && 'min-w-3xl',
					(kind === 'projects' || kind === 'categories') && 'min-w-5xl'
				)}
			>
				<TableHeader>
					<TableRow>
						{tableHeaders[kind].map((label, index) => (
							<TableHead key={index}>{label}</TableHead>
						))}
					</TableRow>
				</TableHeader>
				<TableBody>
					{Array.from({ length: rows }, (_, row) => (
						<TableRow key={row}>
							{tableHeaders[kind].map((_label, column) => (
								<TableCell key={column}>
									<Skeleton
										className={cn(
											'w-full min-w-16',
											kind === 'bookmarks' || kind === 'submissions'
												? 'h-8'
												: 'h-9'
										)}
									/>
								</TableCell>
							))}
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	)
}

function TableFooterSkeleton() {
	return (
		<div
			aria-hidden="true"
			className="flex flex-wrap items-center justify-between gap-4"
		>
			<Skeleton className="h-5 w-40" />
			<Skeleton className="h-8 w-60" />
		</div>
	)
}

export function BookmarksTablePending() {
	const limit = useSearch({
		strict: false,
		select: (search) => (typeof search.limit === 'number' ? search.limit : 25),
	})
	return (
		<div
			data-skeleton="bookmarks-table"
			aria-busy="true"
			className="flex flex-col gap-4"
		>
			<LoadingStatus>Loading bookmarks…</LoadingStatus>
			<TableSkeleton kind="bookmarks" rows={limit} />
			<TableFooterSkeleton />
		</div>
	)
}

export function BookmarksPending() {
	return (
		<div
			data-skeleton="bookmarks"
			className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 pt-4 pb-8 sm:px-6"
		>
			<div className="flex flex-col gap-1">
				<h1 className="text-2xl font-medium tracking-tight">Bookmarks</h1>
				<p className="text-sm text-muted-foreground">
					Your saved projects. Only published projects are shown.
				</p>
			</div>
			<BookmarksTablePending />
		</div>
	)
}

export function SubmissionsPending() {
	const limit = useSearch({
		strict: false,
		select: (search) => (typeof search.limit === 'number' ? search.limit : 25),
	})
	return (
		<div
			data-skeleton="submissions"
			aria-busy="true"
			className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 pt-4 pb-8 sm:px-6"
		>
			<LoadingStatus>Loading submissions…</LoadingStatus>
			<div className="flex flex-col gap-1">
				<h1 className="text-2xl font-medium tracking-tight">Submission</h1>
				<p className="text-sm text-muted-foreground">
					Track your submitted projects and their review status.
				</p>
			</div>
			<div className="flex flex-col gap-4">
				<div
					aria-hidden="true"
					className="flex flex-wrap items-center justify-between gap-3"
				>
					<Skeleton className="h-8 w-full sm:max-w-64" />
					<Skeleton className="h-8 w-40" />
				</div>
				<TableSkeleton kind="submissions" rows={limit} />
				<TableFooterSkeleton />
			</div>
		</div>
	)
}

export function ProjectsPending() {
	return (
		<div
			data-skeleton="admin-projects"
			aria-busy="true"
			className="mx-auto w-full px-4"
		>
			<LoadingStatus>Loading projects…</LoadingStatus>
			<div
				aria-hidden="true"
				className="flex flex-wrap items-center gap-2 py-4"
			>
				<Skeleton className="h-8 w-full max-w-sm" />
				<Skeleton className="h-8 w-36" />
				<Skeleton className="ml-auto h-8 w-24" />
			</div>
			<TableSkeleton kind="projects" />
			<div className="py-4">
				<TableFooterSkeleton />
			</div>
		</div>
	)
}

export function CategoriesTablePending() {
	return (
		<div
			data-skeleton="admin-categories"
			aria-busy="true"
			className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6"
		>
			<LoadingStatus>Loading categories…</LoadingStatus>
			<div className="flex flex-col gap-1">
				<h1 className="text-xl font-semibold">Categories</h1>
				<p className="text-sm text-muted-foreground">
					Manage every category, including empty categories, and its place in
					the hierarchy.
				</p>
			</div>
			<div className="flex flex-col gap-4">
				<div
					aria-hidden="true"
					className="flex flex-wrap items-center justify-between gap-3"
				>
					<Skeleton className="h-8 w-full max-w-sm" />
					<Skeleton className="h-8 w-28" />
				</div>
				<p className="text-xs text-muted-foreground">
					Published projects counts distinct published projects across each
					subtree. Direct assignments includes all statuses assigned directly to
					the category.
				</p>
				<TableSkeleton kind="categories" />
				<TableFooterSkeleton />
			</div>
		</div>
	)
}

function FieldSkeleton({
	label,
	description,
	multiline = false,
}: {
	label: string
	description?: ReactNode
	multiline?: boolean
}) {
	return (
		<Field>
			<FieldTitle className="leading-snug">{label}</FieldTitle>
			<Skeleton className={multiline ? 'h-16 w-full' : 'h-8 w-full'} />
			{description && <FieldDescription>{description}</FieldDescription>}
		</Field>
	)
}

export function CategoryFormPending({
	editing = false,
}: {
	editing?: boolean
}) {
	return (
		<div
			data-skeleton="category-form"
			aria-busy="true"
			className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6"
		>
			<LoadingStatus>Loading category…</LoadingStatus>
			<div>
				<span className="text-sm text-muted-foreground underline">
					Back to categories
				</span>
				<h1 className="mt-1 text-xl font-semibold">
					{editing ? 'Edit category' : 'Create category'}
				</h1>
				<p className="mt-3 text-sm text-muted-foreground">
					Organize the catalogue into up to three levels. Projects belong to
					leaf categories.
				</p>
			</div>
			<div
				aria-hidden="true"
				className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]"
			>
				<FieldGroup>
					<FieldSkeleton label="Name" description="2–100 characters." />
					<FieldSkeleton
						label="Slug"
						description={
							editing
								? 'Changing the name keeps this slug. Edit it explicitly to change the URL.'
								: 'Suggested from the name until you edit the slug. Slugs must be globally unique.'
						}
					/>
					<FieldSkeleton
						label="Description"
						multiline
						description="Write an original description, 1–300 characters."
					/>
					<FieldSkeleton
						label="Parent"
						description="Only parents without direct project assignments and with room for the entire subtree are available. The server rechecks on save."
					/>
					<Skeleton className="h-8 w-32" />
				</FieldGroup>
				<Card>
					<CardHeader>
						<Skeleton className="h-5 w-28" />
						<Skeleton className="h-5 w-3/4" />
					</CardHeader>
					<CardContent>
						<Skeleton className="h-7 w-full" />
					</CardContent>
				</Card>
			</div>
		</div>
	)
}

export function EditCategoryPending() {
	return <CategoryFormPending editing />
}

export function ProjectFormPending() {
	return (
		<div
			data-skeleton="project-form"
			aria-busy="true"
			className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6"
		>
			<LoadingStatus>Loading project…</LoadingStatus>
			<div className="flex flex-col gap-3">
				<span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
					<Skeleton className="size-4" />
					Projects
				</span>
				<div className="flex flex-col gap-1">
					<h1 className="text-xl font-semibold tracking-tight">Edit project</h1>
					<p className="text-sm text-muted-foreground">
						Edit project details. The preview updates as you type.
					</p>
				</div>
			</div>
			<div
				aria-hidden="true"
				className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]"
			>
				<div className="flex min-w-0 flex-col gap-8">
					<div className="flex flex-col gap-4">
						<div className="flex flex-col gap-1">
							<Skeleton className="h-5 w-16" />
							<Skeleton className="h-5 w-60" />
						</div>
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<FieldSkeleton
								label="Name"
								description={<Skeleton className="h-5 w-3/4" />}
							/>
							<FieldSkeleton
								label="Slug"
								description="Auto-filled from the name. You can override it."
							/>
							<FieldSkeleton
								label="Repository URL"
								description={<Skeleton className="h-38.5 w-full" />}
							/>
							<FieldSkeleton label="Website URL" />
						</div>
					</div>
					<div className="flex flex-col gap-4">
						<Skeleton className="h-11 w-3/4" />
						<FieldGroup className="gap-4">
							<FieldSkeleton label="Tagline" />
							<FieldSkeleton label="Description" multiline />
						</FieldGroup>
					</div>
					<div className="flex flex-col gap-4">
						<Skeleton className="h-28 w-full" />
						<Skeleton className="h-64 w-full" />
					</div>
					<div className="flex flex-col gap-4">
						<Skeleton className="h-11 w-3/4" />
						<Skeleton className="aspect-video w-full" />
					</div>
					<CategoryComboboxSkeleton />
				</div>
				<Card>
					<CardHeader>
						<Skeleton className="h-5 w-32" />
					</CardHeader>
					<CardContent className="flex flex-col gap-4">
						<Skeleton className="size-9" />
						<Skeleton className="aspect-video w-full" />
						<Skeleton className="h-10 w-full" />
					</CardContent>
				</Card>
			</div>
		</div>
	)
}

// The control is 32px; its help copy wraps to 16/32/48px as the form narrows.
export function CategoryComboboxSkeleton() {
	return (
		<div
			data-skeleton="category-combobox"
			aria-busy="true"
			className="flex flex-col gap-2"
		>
			<LoadingStatus>Loading categories…</LoadingStatus>
			<div aria-hidden="true" className="flex flex-col gap-2">
				<Skeleton className="h-8 w-full rounded-lg" />
				<p className="text-xs text-muted-foreground">{categoryHelp}</p>
			</div>
		</div>
	)
}

export function ResubmitPending() {
	return (
		<>
			<LoadingStatus>Loading your submission…</LoadingStatus>
			<div
				aria-hidden="true"
				className="flex flex-col gap-1 rounded-lg border bg-muted p-4"
			>
				<Skeleton className="h-5 w-28" />
				<Skeleton className="h-10 w-full sm:h-5" />
			</div>
			<div
				data-skeleton="resubmit-form"
				aria-busy="true"
				aria-hidden="true"
				className="flex flex-col gap-6"
			>
				<div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
					{['Project name', 'Website URL (optional)', 'GitHub repository'].map(
						(label, index) => (
							<Field
								key={label}
								className={index === 2 ? 'sm:col-span-2' : undefined}
							>
								<FieldTitle className="leading-snug">{label}</FieldTitle>
								<Skeleton className="h-10 w-full" />
								{index === 2 && (
									<FieldDescription>
										Enter a public GitHub repository. Our team will review it
										before publishing.
									</FieldDescription>
								)}
							</Field>
						)
					)}
				</div>
				<Skeleton className="h-8 w-full sm:w-36" />
			</div>
		</>
	)
}
