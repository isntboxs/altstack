import {
	IconArrowLeft,
	IconCheck,
	IconCircle,
	IconDeviceFloppy,
	IconEye,
	IconPencil,
} from '@tabler/icons-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
	ClientOnly,
	Link,
	useBlocker,
	useNavigate,
	useRouter,
} from '@tanstack/react-router'
import { useRef, useState } from 'react'
import type { ReactNode } from 'react'

import type { ORPCRouterOutputs } from '@altstack/api/routers'

import { slugify } from '@altstack/shared/lib/slug'
import {
	collectionBodySchema,
	collectionKindLabels,
	collectionKinds,
	sourceRepositorySchema,
} from '@altstack/shared/schemas/collection'
import type { CollectionBody } from '@altstack/shared/schemas/collection'

import {
	Alert,
	AlertDescription,
	AlertTitle,
} from '@altstack/ui/components/alert'
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@altstack/ui/components/alert-dialog'
import { Badge } from '@altstack/ui/components/badge'
import { Button, buttonVariants } from '@altstack/ui/components/button'
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@altstack/ui/components/card'
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from '@altstack/ui/components/field'
import { Input } from '@altstack/ui/components/input'
import {
	NativeSelect,
	NativeSelectOption,
} from '@altstack/ui/components/native-select'
import { Skeleton } from '@altstack/ui/components/skeleton'
import { Textarea } from '@altstack/ui/components/textarea'
import { toast } from '@altstack/ui/components/toast'

import BlockNoteEditor from '#/components/block-note/editor'
import type { BlockNoteEditorHandle } from '#/components/block-note/editor'
import { PublicContent } from '#/components/public-content'
import { CollectionProjectSelector } from '#/features/admin-collections/project-selector'
import type { SelectedProject } from '#/features/admin-collections/project-selector'
import { orpc } from '#/utils/orpc'

type Initial = ORPCRouterOutputs['admin']['collection']['getById']
const empty: CollectionBody = {
	name: '',
	slug: '',
	description: '',
	content: '',
	kind: 'repository',
	sourceRepositoryUrl: '',
	mainProjectId: null,
	status: 'draft',
	projectIds: [],
}
const kindDescriptions = {
	repository: 'Bring projects together from a curated GitHub list.',
	alternatives: 'Help readers find alternatives to a main project.',
	ecosystem: 'Group tools and projects around a shared ecosystem.',
}

function EditorSection({
	number,
	title,
	description,
	children,
	action,
}: {
	number: string
	title: string
	description: string
	children: ReactNode
	action?: ReactNode
}) {
	return (
		<Card className="min-w-0">
			<CardHeader className="border-b">
				<CardTitle>
					<h2 className="flex items-center gap-2.5">
						<span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs text-foreground">
							{number}
						</span>
						{title}
					</h2>
				</CardTitle>
				<CardDescription>{description}</CardDescription>
				{action && (
					<CardAction className="col-start-1 row-span-1 row-start-3 justify-self-start sm:col-start-2 sm:row-span-2 sm:row-start-1">
						{action}
					</CardAction>
				)}
			</CardHeader>
			<CardContent>{children}</CardContent>
		</Card>
	)
}

export function CollectionEditor({ initial }: { initial?: Initial }) {
	const queryClient = useQueryClient()
	const navigate = useNavigate()
	const router = useRouter()
	const editor = useRef<BlockNoteEditorHandle>(null)
	const customizedSlug = useRef(!!initial)
	const saved = useRef(false)
	const errorsRef = useRef<HTMLDivElement>(null)
	const initialValue: CollectionBody = initial
		? {
				name: initial.name,
				slug: initial.slug,
				description: initial.description,
				content: initial.content,
				kind: initial.kind,
				sourceRepositoryUrl: initial.sourceRepositoryUrl,
				mainProjectId: initial.mainProjectId,
				status: initial.status,
				projectIds: initial.projects.map((p) => p.id),
			}
		: empty
	const [value, setValue] = useState(initialValue)
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
	const [reloading, setReloading] = useState(false)
	const [editorRevision, setEditorRevision] = useState(0)
	const [members, setMembers] = useState<Array<SelectedProject>>(
		initial?.projects ?? []
	)
	const [target, setTarget] = useState<SelectedProject | null>(
		initial?.mainProject ?? null
	)
	const [error, setError] = useState('')
	const [preview, setPreview] = useState(false)
	const create = useMutation(orpc.admin.collection.create.mutationOptions())
	const update = useMutation(orpc.admin.collection.update.mutationOptions())
	const busy = create.isPending || update.isPending || reloading
	const dirty =
		JSON.stringify({
			...value,
			content: value.content.trimEnd(),
			projectIds: members.map((p) => p.id),
		}) !==
		JSON.stringify({ ...initialValue, content: initialValue.content.trimEnd() })
	const blocker = useBlocker({
		shouldBlockFn: () => !saved.current && dirty,
		enableBeforeUnload: () => !saved.current && dirty,
		withResolver: true,
	})
	const readiness = [
		{
			label: 'Title, URL, and description added',
			done:
				value.name.trim().length > 0 &&
				collectionBodySchema.shape.slug.safeParse(value.slug).success &&
				value.description.trim().length > 0,
		},
		{
			label:
				value.kind === 'repository'
					? 'Valid source repository linked'
					: 'Published main project selected',
			done:
				value.kind === 'repository'
					? sourceRepositorySchema.safeParse(value.sourceRepositoryUrl).success
					: target?.status === 'published',
		},
		{
			label: 'At least one published member',
			done:
				members.length > 0 && members.every((p) => p.status === 'published'),
		},
	]
	const ready = readiness.every((item) => item.done)
	function fieldProps(name: string) {
		return {
			'aria-invalid': !!fieldErrors[name],
			'aria-describedby': `collection-${name}-help${fieldErrors[name] ? ` collection-${name}-error` : ''}`,
		}
	}
	function fieldError(name: string) {
		return fieldErrors[name] ? (
			<FieldError id={`collection-${name}-error`}>
				{fieldErrors[name]}
			</FieldError>
		) : null
	}
	function showError(message: string) {
		setError(message)
		requestAnimationFrame(() => errorsRef.current?.focus())
	}

	async function save() {
		if (busy) return
		editor.current?.flush()
		const parsed = collectionBodySchema.safeParse({
			...value,
			content: editor.current?.readMarkdown() ?? value.content,
			projectIds: members.map((p) => p.id),
		})
		if (!parsed.success) {
			const fields: Record<string, string> = {}
			for (const issue of parsed.error.issues) {
				if (issue.path.length > 0) fields[String(issue.path[0])] = issue.message
			}
			setFieldErrors(fields)
			showError(parsed.error.issues.map((issue) => issue.message).join(' '))
			return
		}
		setError('')
		setFieldErrors({})
		try {
			if (initial) {
				await update.mutateAsync({
					params: { id: initial.id },
					body: { ...parsed.data, expectedVersion: initial.version },
				})
			} else {
				await create.mutateAsync({ body: parsed.data })
			}
			saved.current = true
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: orpc.admin.collection.key(),
				}),
				queryClient.invalidateQueries({ queryKey: orpc.collection.key() }),
			])
			toast.add({ type: 'success', title: 'Collection saved' })
			await navigate({ to: '/admin/collections' })
		} catch (err) {
			showError(
				err instanceof Error ? err.message : 'Unable to save collection.'
			)
		}
	}
	async function reload() {
		if (!window.confirm('Discard unsaved edits and reload this collection?')) {
			return
		}
		setReloading(true)
		try {
			await router.invalidate()
			setValue(initialValue)
			setMembers(initial?.projects ?? [])
			setTarget(initial?.mainProject ?? null)
			setEditorRevision((revision) => revision + 1)
			setError('')
			setFieldErrors({})
			setPreview(false)
		} catch {
			showError('Unable to reload. Your edits have been kept.')
		} finally {
			setReloading(false)
		}
	}
	function togglePreview() {
		editor.current?.flush()
		setValue((previous) => {
			return {
				...previous,
				content: editor.current?.readMarkdown() ?? previous.content,
			}
		})
		setPreview(!preview)
	}

	return (
		<div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
			<header className="flex flex-col gap-4">
				<Link
					to="/admin/collections"
					className="flex w-fit items-center gap-1.5 rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
				>
					<IconArrowLeft className="size-4" aria-hidden="true" />
					Back to collections
				</Link>
				<div className="flex flex-col gap-2">
					<h1 className="text-2xl font-semibold tracking-tight">
						{initial ? 'Edit collection' : 'Create collection'}
					</h1>
					<p className="max-w-2xl text-sm text-muted-foreground">
						{initial
							? 'Refine your collection, manage its projects, and choose when it goes public.'
							: 'Give your collection a purpose, choose its projects, and share it with the community.'}
					</p>
				</div>
			</header>
			{error && (
				<div
					ref={errorsRef}
					tabIndex={-1}
					className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					<Alert id="collection-errors" variant="destructive">
						<AlertTitle>Unable to save collection</AlertTitle>
						<AlertDescription>
							<p>{error}</p>
							<p>
								Your edits are kept here. Review the fields or reload if this
								collection changed elsewhere.
							</p>
						</AlertDescription>
					</Alert>
				</div>
			)}
			<form
				onSubmit={(e) => {
					e.preventDefault()
					void save()
				}}
				className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]"
			>
				<fieldset disabled={busy} className="flex min-w-0 flex-col gap-6">
					<legend className="sr-only">Collection details and projects</legend>
					<EditorSection
						number="1"
						title="Collection details"
						description="Help readers understand what this collection is about."
					>
						<FieldGroup>
							<Field data-invalid={!!fieldErrors.name}>
								<FieldLabel htmlFor="collection-name">Title</FieldLabel>
								<Input
									id="collection-name"
									{...fieldProps('name')}
									required
									maxLength={120}
									placeholder="Name your collection"
									value={value.name}
									onChange={(e) => {
										const name = e.target.value
										setValue({
											...value,
											name,
											slug: customizedSlug.current
												? value.slug
												: slugify(name).slice(0, 100).replace(/-+$/, ''),
										})
									}}
								/>
								<FieldDescription id="collection-name-help">
									A clear, specific title makes your collection easier to find.
								</FieldDescription>
								{fieldError('name')}
							</Field>
							<Field data-invalid={!!fieldErrors.slug}>
								<FieldLabel htmlFor="collection-slug">Slug</FieldLabel>
								<Input
									id="collection-slug"
									{...fieldProps('slug')}
									required
									maxLength={100}
									pattern="[a-z0-9]+(-[a-z0-9]+)*"
									placeholder="your-collection"
									value={value.slug}
									onChange={(e) => {
										customizedSlug.current = true
										setValue({ ...value, slug: e.target.value })
									}}
								/>
								<FieldDescription
									id="collection-slug-help"
									className="wrap-anywhere"
								>
									/collections/{value.slug || 'your-collection'}
									<br />
									{initial
										? 'Changing this slug changes the public URL.'
										: 'Suggested from the title. You can customize it.'}
								</FieldDescription>
								{fieldError('slug')}
							</Field>
							<Field data-invalid={!!fieldErrors.description}>
								<div className="flex items-center justify-between gap-2">
									<FieldLabel htmlFor="collection-description">
										Description
									</FieldLabel>
									<span className="text-xs text-muted-foreground">
										{value.description.length}/300
									</span>
								</div>
								<Textarea
									id="collection-description"
									{...fieldProps('description')}
									required
									maxLength={300}
									rows={3}
									placeholder="What will readers find in this collection?"
									value={value.description}
									onChange={(e) =>
										setValue({ ...value, description: e.target.value })
									}
								/>
								<FieldDescription id="collection-description-help">
									A short summary shown on the collection’s discovery card.
								</FieldDescription>
								{fieldError('description')}
							</Field>
						</FieldGroup>
					</EditorSection>
					<EditorSection
						number="2"
						title="Type & source"
						description="Choose how this collection connects its projects."
					>
						<FieldGroup>
							<Field>
								<FieldLabel htmlFor="collection-kind">Type</FieldLabel>
								<NativeSelect
									id="collection-kind"
									className="w-full"
									value={value.kind}
									aria-describedby="collection-kind-help"
									onChange={(e) => {
										const kind = collectionBodySchema.shape.kind.parse(
											e.target.value
										)
										setTarget(null)
										setValue({
											...value,
											kind,
											mainProjectId: null,
											sourceRepositoryUrl: kind === 'repository' ? '' : null,
										})
									}}
								>
									{collectionKinds.map((kind) => (
										<NativeSelectOption key={kind} value={kind}>
											{collectionKindLabels[kind]}
										</NativeSelectOption>
									))}
								</NativeSelect>
								<FieldDescription id="collection-kind-help">
									{kindDescriptions[value.kind]}
								</FieldDescription>
							</Field>
							{value.kind === 'repository' ? (
								<Field data-invalid={!!fieldErrors.sourceRepositoryUrl}>
									<FieldLabel htmlFor="collection-source">
										Source repository URL
									</FieldLabel>
									<Input
										id="collection-source"
										{...fieldProps('sourceRepositoryUrl')}
										type="url"
										required
										placeholder="https://github.com/owner/repository"
										value={value.sourceRepositoryUrl ?? ''}
										onChange={(e) =>
											setValue({
												...value,
												sourceRepositoryUrl: e.target.value,
											})
										}
									/>
									<FieldDescription id="collection-sourceRepositoryUrl-help">
										Link the original GitHub list. You’ll choose its members
										below; projects are not imported automatically.
									</FieldDescription>
									{fieldError('sourceRepositoryUrl')}
								</Field>
							) : (
								<Alert>
									<AlertTitle>Choose a main project below</AlertTitle>
									<AlertDescription>
										{value.kind === 'alternatives'
											? 'Select the project readers are looking for alternatives to.'
											: 'Select the project at the center of this ecosystem.'}{' '}
										If the main project becomes unavailable, this collection
										will be hidden publicly.
									</AlertDescription>
								</Alert>
							)}
						</FieldGroup>
					</EditorSection>
					<EditorSection
						number="3"
						title="Collection projects"
						description="Add published projects, then arrange them in the order readers will see."
					>
						<CollectionProjectSelector
							members={members}
							target={target}
							needsMainProject={value.kind !== 'repository'}
							busy={busy}
							onMembersChange={setMembers}
							onTargetChange={(project) => {
								setTarget(project)
								setValue({ ...value, mainProjectId: project.id })
							}}
						/>
					</EditorSection>
					<EditorSection
						number="4"
						title="Editorial content"
						description="Add context, recommendations, or a guide for your readers. Optional."
						action={
							<Button
								type="button"
								variant="outline"
								size="sm"
								aria-expanded={preview}
								aria-controls="collection-content-preview"
								onClick={togglePreview}
							>
								{preview ? (
									<IconPencil data-icon="inline-start" />
								) : (
									<IconEye data-icon="inline-start" />
								)}
								{preview ? 'Hide public preview' : 'Show public preview'}
							</Button>
						}
					>
						<div className="flex min-w-0 flex-col gap-4">
							<div className="min-w-0 rounded-lg border p-4 sm:p-5">
								<ClientOnly
									fallback={
										<div className="flex min-h-40 flex-col gap-3 p-4">
											<output className="text-sm text-muted-foreground">
												Loading editor…
											</output>
											<Skeleton className="h-4 w-3/4" />
											<Skeleton className="h-4 w-1/2" />
										</div>
									}
								>
									<BlockNoteEditor
										key={editorRevision}
										ref={editor}
										value={value.content}
										onChange={(content) =>
											setValue((previous) => {
												return { ...previous, content }
											})
										}
									/>
								</ClientOnly>
							</div>
							{preview && (
								<section
									id="collection-content-preview"
									aria-label="Public content preview"
									className="min-w-0 overflow-hidden rounded-lg border bg-background p-4"
								>
									<p className="mb-4 text-xs font-medium text-muted-foreground">
										Public content preview
									</p>
									{value.content.trim() ? (
										<PublicContent
											slug={`collections/${value.slug}`}
											content={value.content}
										/>
									) : (
										<p className="text-sm text-muted-foreground">
											Write some content above to see how it will look to
											readers.
										</p>
									)}
								</section>
							)}
						</div>
					</EditorSection>
				</fieldset>
				<aside
					aria-label="Collection publication"
					className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-20"
				>
					<Card>
						<CardHeader className="border-b">
							<CardTitle>
								<h2>Publication</h2>
							</CardTitle>
							<CardDescription>
								Control when readers can see this collection.
							</CardDescription>
							<CardAction>
								<Badge
									variant={
										value.status === 'published' ? 'default' : 'secondary'
									}
								>
									{value.status === 'published' ? 'Published' : 'Draft'}
								</Badge>
							</CardAction>
						</CardHeader>
						<CardContent className="flex flex-col gap-5">
							<Field data-disabled={busy}>
								<FieldLabel htmlFor="collection-status">Publication</FieldLabel>
								<NativeSelect
									id="collection-status"
									className="w-full"
									disabled={busy}
									aria-describedby="collection-status-help"
									value={value.status}
									onChange={(e) =>
										setValue({
											...value,
											status:
												e.target.value === 'published' ? 'published' : 'draft',
										})
									}
								>
									<NativeSelectOption value="draft">Draft</NativeSelectOption>
									<NativeSelectOption value="published">
										Published
									</NativeSelectOption>
								</NativeSelect>
								<FieldDescription id="collection-status-help">
									{value.status === 'draft'
										? 'Only admins can see this collection. Save it now and publish when it’s ready.'
										: 'Saving will make this collection visible to everyone.'}
								</FieldDescription>
							</Field>
							<div className="flex flex-col gap-3 border-t pt-4">
								<h3 className="text-sm font-medium">Before publishing</h3>
								<ul className="flex flex-col gap-3">
									{readiness.map((item) => (
										<li
											key={item.label}
											className="flex items-start gap-2 text-xs"
										>
											{item.done ? (
												<IconCheck
													className="size-4 shrink-0"
													aria-hidden="true"
												/>
											) : (
												<IconCircle
													className="size-4 shrink-0 text-muted-foreground"
													aria-hidden="true"
												/>
											)}
											<span
												className={
													item.done
														? 'text-foreground'
														: 'text-muted-foreground'
												}
											>
												<span className="sr-only">
													{item.done ? 'Complete: ' : 'Needed: '}
												</span>
												{item.label}
											</span>
										</li>
									))}
								</ul>
								{!ready && value.status === 'published' && (
									<output className="text-xs text-destructive">
										Complete the checklist before publishing.
									</output>
								)}
							</div>
							<div className="flex flex-col gap-2 border-t pt-4">
								<Button type="submit" disabled={busy}>
									<IconDeviceFloppy data-icon="inline-start" />
									{reloading
										? 'Reloading…'
										: busy
											? 'Saving…'
											: 'Save collection'}
								</Button>
								<Link
									to="/admin/collections"
									className={buttonVariants({ variant: 'outline' })}
								>
									Cancel
								</Link>
								<output className="pt-1 text-center text-xs text-muted-foreground">
									{dirty
										? 'You have unsaved changes'
										: initial
											? 'No unsaved changes'
											: 'Your collection starts as a draft'}
								</output>
							</div>
							{initial && (
								<div className="flex flex-col gap-2 border-t pt-4">
									<p className="text-xs wrap-anywhere text-muted-foreground">
										Written by {initial.authorName}. Authorship stays with the
										original writer.
									</p>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										disabled={busy}
										onClick={() => void reload()}
									>
										Discard and reload
									</Button>
								</div>
							)}
						</CardContent>
					</Card>
					<p className="px-1 text-xs leading-relaxed text-muted-foreground">
						Projects are curated manually. Unavailable members are hidden from
						readers and must be removed before saving.
					</p>
				</aside>
			</form>
			<AlertDialog
				open={blocker.status === 'blocked'}
				onOpenChange={(open) => {
					if (!open) blocker.reset?.()
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Leave without saving?</AlertDialogTitle>
						<AlertDialogDescription>
							Your collection has unsaved changes. Save your work before leaving
							to keep these edits.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Keep editing</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							onClick={() => blocker.proceed?.()}
						>
							Discard changes
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	)
}
