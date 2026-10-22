import {
	useMutation,
	useQueryClient,
	useSuspenseQuery,
} from '@tanstack/react-query'
import {
	createFileRoute,
	Link,
	redirect,
	useRouter,
} from '@tanstack/react-router'
import { useState } from 'react'
import type { SubmitEvent } from 'react'

import type { ORPCRouterOutputs } from '@altstack/api/routers'

import {
	adminCreateTagInputSchema,
	adminUpdateTagInputSchema,
} from '@altstack/shared/schemas/tag'

import { Badge } from '@altstack/ui/components/badge'
import { Button } from '@altstack/ui/components/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@altstack/ui/components/dialog'
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from '@altstack/ui/components/field'
import { Input } from '@altstack/ui/components/input'
import { Skeleton } from '@altstack/ui/components/skeleton'
import { Switch } from '@altstack/ui/components/switch'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@altstack/ui/components/table'
import { Textarea } from '@altstack/ui/components/textarea'
import { toast } from '@altstack/ui/components/toast'

import { PublicError } from '#/components/public-page-state'
import { tagSearchSchema } from '#/features/tag/search'
import { invalidateCatalog } from '#/utils/invalidate-catalog'
import { orpc } from '#/utils/orpc'

/** Uses a fixed admin page size and name ordering for searchable tag management. */
const listOptions = (query: { q?: string; page?: number }) =>
	orpc.admin.tag.list.queryOptions({
		input: { query: { ...query, sort: 'name-asc', limit: 50 } },
	})
type AdminTag = ORPCRouterOutputs['admin']['tag']['list']['tags'][number]

export const Route = createFileRoute('/_main/admin/tags')({
	validateSearch: tagSearchSchema.pick({ q: true, page: true }),
	loaderDeps: ({ search: { q, page } }) => {
		return { q, page }
	},
	beforeLoad: ({ context: { auth } }) => {
		if (auth.user.role !== 'admin') throw redirect({ to: '/', replace: true })
	},
	loader: ({ context, deps }) => context.queryClient.query(listOptions(deps)),
	pendingMs: 250,
	pendingMinMs: 200,
	pendingComponent: AdminTagsPending,
	errorComponent: () => <PublicError title="Unable to load tags" />,
	component: AdminTags,
})

/** Manages tag curation and guarded deletion, refreshing public and admin caches on success. */
function AdminTags() {
	const search = Route.useSearch()
	const navigate = Route.useNavigate()
	const { data } = useSuspenseQuery(listOptions(search))
	const [editing, setEditing] = useState<AdminTag | 'new' | null>(null)
	const [deleting, setDeleting] = useState<AdminTag | null>(null)
	const queryClient = useQueryClient()
	const router = useRouter()
	/** Refreshes catalogue data before confirming the completed tag operation. */
	const saved = async (title = 'Tag saved') => {
		await invalidateCatalog(queryClient)
		await router.invalidate()
		toast.add({ type: 'success', title })
	}
	const remove = useMutation({
		...orpc.admin.tag.remove.mutationOptions(),
		onSuccess: async () => {
			setDeleting(null)
			await saved('Tag deleted')
		},
	})
	return (
		<div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6">
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div className="flex flex-col gap-1">
					<h1 className="text-xl font-semibold">Tags</h1>
					<p className="max-w-2xl text-sm text-muted-foreground">
						Tags sync automatically from GitHub Topics. Curate their names and
						descriptions, or hide unwanted tags. Only unused tags can be
						deleted.
					</p>
				</div>
				<Button onClick={() => setEditing('new')}>Create tag</Button>
			</div>
			<form
				key={search.q ?? ''}
				className="flex items-end gap-2"
				onSubmit={(event) => {
					event.preventDefault()
					const q =
						formText(new FormData(event.currentTarget), 'q').trim() || undefined
					void navigate({ search: { q }, resetScroll: false })
				}}
			>
				<Field className="max-w-sm">
					<FieldLabel htmlFor="admin-tag-search">Search tags</FieldLabel>
					<Input
						id="admin-tag-search"
						name="q"
						defaultValue={search.q ?? ''}
						maxLength={100}
						placeholder="Search by name..."
					/>
				</Field>
				<Button variant="outline" type="submit">
					Search
				</Button>
				{search.q && (
					<Button
						variant="ghost"
						nativeButton={false}
						render={<Link to="/admin/tags" search={{}} />}
					>
						Reset
					</Button>
				)}
			</form>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Name</TableHead>
						<TableHead>GitHub topic</TableHead>
						<TableHead>Visibility</TableHead>
						<TableHead>Published projects</TableHead>
						<TableHead>Assignments</TableHead>
						<TableHead>Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{data.tags.length === 0 ? (
						<TableRow>
							<TableCell colSpan={6}>No tags found.</TableCell>
						</TableRow>
					) : (
						data.tags.map((tag) => (
							<TableRow key={tag.id}>
								<TableCell>
									{!tag.hidden && tag.projectCount > 0 ? (
										<Link
											to="/tags/$slug"
											params={{ slug: tag.slug }}
											className="font-medium hover:underline"
										>
											{tag.name}
										</Link>
									) : (
										tag.name
									)}
								</TableCell>
								<TableCell>{tag.slug}</TableCell>
								<TableCell>
									<Badge variant={tag.hidden ? 'outline' : 'secondary'}>
										{tag.hidden ? 'Hidden' : 'Visible'}
									</Badge>
								</TableCell>
								<TableCell>{tag.projectCount}</TableCell>
								<TableCell>{tag.assignmentCount}</TableCell>
								<TableCell>
									<div className="flex gap-2">
										<Button
											size="sm"
											variant="outline"
											onClick={() => setEditing(tag)}
										>
											Edit<span className="sr-only"> {tag.name}</span>
										</Button>
										<Button
											size="sm"
											variant="ghost"
											disabled={tag.assignmentCount > 0}
											title={
												tag.assignmentCount > 0
													? 'Hide tags that are still assigned to projects.'
													: undefined
											}
											onClick={() => {
												remove.reset()
												setDeleting(tag)
											}}
										>
											Delete<span className="sr-only"> {tag.name}</span>
										</Button>
									</div>
								</TableCell>
							</TableRow>
						))
					)}
				</TableBody>
			</Table>
			<div className="flex items-center justify-between gap-3">
				<Button
					variant="outline"
					disabled={!data.pagination.hasPreviousPage}
					onClick={() =>
						void navigate({
							search: (prev) => {
								return { ...prev, page: (prev.page ?? 1) - 1 }
							},
							resetScroll: false,
						})
					}
				>
					Previous
				</Button>
				<span className="text-sm text-muted-foreground">
					Page {data.pagination.page} of{' '}
					{Math.max(1, data.pagination.totalPages)}
				</span>
				<Button
					variant="outline"
					disabled={!data.pagination.hasNextPage}
					onClick={() =>
						void navigate({
							search: (prev) => {
								return { ...prev, page: (prev.page ?? 1) + 1 }
							},
							resetScroll: false,
						})
					}
				>
					Next
				</Button>
			</div>
			{editing && (
				<TagEditor
					tag={editing === 'new' ? undefined : editing}
					onClose={() => setEditing(null)}
					onSaved={saved}
				/>
			)}
			<Dialog
				open={deleting !== null}
				onOpenChange={(open) => {
					if (!open && !remove.isPending) setDeleting(null)
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete {deleting?.name}?</DialogTitle>
						<DialogDescription>
							This deletes the unused tag. GitHub sync can create it again if a
							repository uses this topic.
						</DialogDescription>
					</DialogHeader>
					{remove.error && (
						<p role="alert" className="text-sm text-destructive">
							{remove.error.message}
						</p>
					)}
					<DialogFooter>
						<Button
							variant="outline"
							disabled={remove.isPending}
							onClick={() => setDeleting(null)}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							disabled={remove.isPending}
							onClick={() => {
								if (deleting) remove.mutate({ params: { id: deleting.id } })
							}}
						>
							{remove.isPending ? 'Deleting…' : 'Delete tag'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	)
}

/** Creates topics or edits their display metadata while keeping existing topic slugs stable. */
function TagEditor({
	tag,
	onClose,
	onSaved,
}: {
	tag?: AdminTag
	onClose: () => void
	onSaved: () => Promise<void>
}) {
	const [hidden, setHidden] = useState(tag?.hidden ?? false)
	const [error, setError] = useState<string | null>(null)
	const create = useMutation(orpc.admin.tag.create.mutationOptions())
	const update = useMutation(orpc.admin.tag.update.mutationOptions())
	const pending = create.isPending || update.isPending
	async function submit(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault()
		setError(null)
		const form = new FormData(event.currentTarget)
		const body = {
			name: formText(form, 'name'),
			description: formText(form, 'description').trim() || null,
			hidden,
		}
		try {
			if (tag) {
				await update.mutateAsync(
					adminUpdateTagInputSchema.parse({ params: { id: tag.id }, body })
				)
			} else {
				await create.mutateAsync(
					adminCreateTagInputSchema.parse({
						body: { ...body, slug: formText(form, 'slug') },
					})
				)
			}
			await onSaved()
			onClose()
		} catch (cause) {
			setError(
				cause instanceof Error
					? cause.message
					: 'Unable to save tag. Please retry.'
			)
		}
	}
	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open && !pending) onClose()
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{tag ? 'Edit tag' : 'Create tag'}</DialogTitle>
					<DialogDescription>
						Display changes and visibility are preserved during GitHub sync.
					</DialogDescription>
				</DialogHeader>
				<form
					onSubmit={(event) => void submit(event)}
					className="flex flex-col gap-6"
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="tag-slug">GitHub topic</FieldLabel>
							<Input
								id="tag-slug"
								name="slug"
								defaultValue={tag?.slug ?? ''}
								disabled={!!tag || pending}
								required
								pattern="[a-z0-9][a-z0-9\-]{0,49}"
								maxLength={50}
								placeholder="typescript"
							/>
							<FieldDescription>
								The topic is the permanent URL and sync identity.
							</FieldDescription>
						</Field>
						<Field>
							<FieldLabel htmlFor="tag-name">Display name</FieldLabel>
							<Input
								id="tag-name"
								name="name"
								defaultValue={tag?.name ?? ''}
								required
								maxLength={100}
								disabled={pending}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="tag-description">Description</FieldLabel>
							<Textarea
								id="tag-description"
								name="description"
								defaultValue={tag?.description ?? ''}
								maxLength={1000}
								disabled={pending}
							/>
						</Field>
						<Field orientation="horizontal">
							<Switch
								id="tag-hidden"
								checked={hidden}
								onCheckedChange={setHidden}
								disabled={pending}
							/>
							<FieldLabel htmlFor="tag-hidden">
								Hide from public pages
							</FieldLabel>
						</Field>
					</FieldGroup>
					{error && (
						<p role="alert" className="text-sm text-destructive">
							{error}
						</p>
					)}
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							disabled={pending}
							onClick={onClose}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={pending}>
							{pending ? 'Saving…' : 'Save tag'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}

/** Reads a form string, treating absent or non-text values as empty. */
function formText(form: FormData, name: string) {
	const value = form.get(name)
	return typeof value === 'string' ? value : ''
}

/** Reserves the admin heading and table layout while tag data loads. */
function AdminTagsPending() {
	return (
		<div
			aria-busy="true"
			className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6"
		>
			<output className="sr-only">Loading tags…</output>
			<h1 className="text-xl font-semibold">Tags</h1>
			{Array.from({ length: 8 }, (_, index) => (
				<Skeleton key={index} className="h-10 w-full" />
			))}
		</div>
	)
}
