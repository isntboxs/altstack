import { IconArrowLeft, IconDeviceFloppy } from '@tabler/icons-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
	ClientOnly,
	Link,
	useBlocker,
	useNavigate,
	useRouter,
} from '@tanstack/react-router'
import { useRef, useState } from 'react'

import type { ORPCRouterOutputs } from '@altstack/api/routers'

import { slugify } from '@altstack/shared/lib/slug'
import { blogBodySchema, blogReadTime } from '@altstack/shared/schemas'
import type { BlogBody } from '@altstack/shared/schemas'

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
import { Button, buttonVariants } from '@altstack/ui/components/button'
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from '@altstack/ui/components/collapsible'
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
import { BlogCoverInput } from '#/features/admin-blogs/cover-input'
import { orpc } from '#/utils/orpc'

type Initial = ORPCRouterOutputs['admin']['blog']['getById']
const empty: BlogBody = {
	title: '',
	slug: '',
	description: '',
	coverUrl: '',
	content: '',
	status: 'draft',
}

function useBlogEditor(initial: Initial | undefined) {
	const queryClient = useQueryClient()
	const navigate = useNavigate()
	const router = useRouter()
	const editor = useRef<BlockNoteEditorHandle>(null)
	const customizedSlug = useRef(!!initial)
	const saved = useRef(false)
	const initialValue: BlogBody = initial
		? {
				title: initial.title,
				slug: initial.slug,
				description: initial.description,
				coverUrl: initial.coverUrl,
				content: initial.content,
				status: initial.status,
			}
		: empty
	const [value, setValue] = useState(initialValue)
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
	const [error, setError] = useState('')
	const [conflict, setConflict] = useState(false)
	const [reload, setReload] = useState(false)
	const [reloading, setReloading] = useState(false)
	const [coverBusy, setCoverBusy] = useState(false)
	const [coverRevision, setCoverRevision] = useState(0)
	const create = useMutation(orpc.admin.blog.create.mutationOptions())
	const update = useMutation(orpc.admin.blog.update.mutationOptions())
	const saving = create.isPending || update.isPending || reloading
	const busy = saving || coverBusy
	const blocker = useBlocker({
		shouldBlockFn: () =>
			!saved.current && JSON.stringify(value) !== JSON.stringify(initialValue),
		enableBeforeUnload: () =>
			!saved.current && JSON.stringify(value) !== JSON.stringify(initialValue),
		withResolver: true,
	})
	function setField<K extends keyof BlogBody>(key: K, next: BlogBody[K]) {
		setValue((previous) => {
			return { ...previous, [key]: next }
		})
	}
	function fieldProps(name: string) {
		return {
			'aria-invalid': !!fieldErrors[name],
			'aria-describedby': fieldErrors[name] ? `blog-${name}-error` : undefined,
		}
	}
	function fieldError(name: string) {
		return fieldErrors[name] ? (
			<FieldError id={`blog-${name}-error`}>{fieldErrors[name]}</FieldError>
		) : null
	}
	function onTitleChange(title: string) {
		setValue((previous) => {
			return {
				...previous,
				title,
				...(!customizedSlug.current
					? {
							slug: slugify(title)
								.replace(/[^a-z0-9]+/g, '-')
								.replace(/^-+/, '')
								.slice(0, 160)
								.replace(/-+$/, ''),
						}
					: {}),
			}
		})
	}
	function onSlugChange(slug: string) {
		customizedSlug.current = true
		setField('slug', slug)
	}
	async function submit(event: React.SubmitEvent<HTMLFormElement>) {
		event.preventDefault()
		if (busy) return
		editor.current?.flush()
		const parsed = blogBodySchema.safeParse({
			...value,
			content: editor.current?.readMarkdown() ?? value.content,
		})
		if (!parsed.success) {
			const fields: Record<string, string> = {}
			for (const issue of parsed.error.issues) {
				const field = String(issue.path[0])
				fields[field] = fields[field] ?? issue.message
			}
			setFieldErrors(fields)
			document.getElementById(`blog-${Object.keys(fields)[0]}`)?.focus()
			return
		}
		setFieldErrors({})
		setError('')
		try {
			if (initial) {
				await update.mutateAsync({
					params: { id: initial.id },
					body: { ...parsed.data, expectedVersion: initial.version },
				})
			} else await create.mutateAsync({ body: parsed.data })
		} catch (err) {
			if (
				typeof err === 'object' &&
				err !== null &&
				'code' in err &&
				err.code === 'UPLOAD_EXPIRED'
			) {
				setField('coverUrl', initial?.coverUrl ?? '')
				setCoverRevision((previous) => previous + 1)
			}
			setError(
				err instanceof Error ? err.message : 'Unable to save this blog post.'
			)
			setConflict(
				typeof err === 'object' &&
					err !== null &&
					'code' in err &&
					err.code === 'CONFLICT'
			)
			return
		}
		saved.current = true
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: orpc.admin.blog.key() }),
			queryClient.invalidateQueries({ queryKey: orpc.blog.key() }),
		])
		toast.add({
			type: 'success',
			title:
				value.status === 'published' ? 'Blog post published' : 'Draft saved',
		})
		await navigate({ to: '/admin/blogs' })
	}
	return {
		initial,
		queryClient,
		router,
		editor,
		onTitleChange,
		onSlugChange,
		value,
		fieldErrors,
		error,
		conflict,
		reload,
		setReload,
		setReloading,
		coverBusy,
		setCoverBusy,
		coverRevision,
		saving,
		busy,
		blocker,
		setField,
		fieldProps,
		fieldError,
		submit,
	}
}

export function BlogEditor({ initial }: { initial?: Initial }) {
	const state = useBlogEditor(initial)
	const {
		queryClient,
		router,
		editor,
		value,
		error,
		conflict,
		reload,
		setReload,
		setReloading,
		coverBusy,
		saving,
		busy,
		blocker,
		submit,
	} = state

	return (
		<div className="mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
			<Link
				to="/admin/blogs"
				className={buttonVariants({ variant: 'ghost', className: 'w-fit' })}
			>
				<IconArrowLeft data-icon="inline-start" />
				Back to blogs
			</Link>
			<header className="flex flex-col gap-2">
				<h1 className="text-2xl font-semibold tracking-tight">
					{initial ? 'Edit blog post' : 'Create blog post'}
				</h1>
				<p className="text-sm text-muted-foreground">
					Share ideas, tutorials, and perspectives on technology.
				</p>
			</header>
			<form
				onSubmit={submit}
				noValidate
				className="flex min-w-0 flex-col gap-6"
			>
				{error && (
					<Alert variant="destructive">
						<AlertTitle>Unable to save blog post</AlertTitle>
						<AlertDescription>
							<p>{error}</p>
							{conflict && initial && (
								<Button
									type="button"
									variant="outline"
									onClick={() => setReload(true)}
								>
									Reload saved version
								</Button>
							)}
						</AlertDescription>
					</Alert>
				)}
				<BlogFields {...state} />
				<BlogContentPreview editor={editor} value={value} />
				<div className="flex flex-wrap justify-end gap-3 border-t pt-4">
					<Link
						to="/admin/blogs"
						className={buttonVariants({ variant: 'outline' })}
					>
						Cancel
					</Link>
					<Button type="submit" disabled={busy}>
						<IconDeviceFloppy data-icon="inline-start" />
						{saving
							? 'Saving…'
							: coverBusy
								? 'Uploading cover…'
								: value.status === 'published'
									? 'Save and publish'
									: 'Save draft'}
					</Button>
				</div>
			</form>
			<AlertDialog open={blocker.status === 'blocked'}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
						<AlertDialogDescription>
							Your changes will be lost if you leave this page.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel onClick={() => blocker.reset?.()}>
							Keep editing
						</AlertDialogCancel>
						<AlertDialogAction onClick={() => blocker.proceed?.()}>
							Discard changes
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
			<AlertDialog open={reload} onOpenChange={setReload}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Reload the saved version?</AlertDialogTitle>
						<AlertDialogDescription>
							This replaces your unsaved changes with the latest saved post.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={busy}>Keep editing</AlertDialogCancel>
						<AlertDialogAction
							disabled={busy}
							onClick={async () => {
								setReloading(true)
								await (async () => {
									await queryClient.invalidateQueries({
										queryKey: orpc.admin.blog.key(),
									})
									await router.invalidate({ sync: true })
								})().finally(() => {
									setReloading(false)
									setReload(false)
								})
							}}
						>
							Reload saved version
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	)
}

type BlogEditorState = ReturnType<typeof useBlogEditor>

function BlogFields({
	editor,
	onTitleChange,
	onSlugChange,
	value,
	fieldErrors,
	setCoverBusy,
	coverRevision,
	saving,
	busy,
	setField,
	fieldProps,
	fieldError,
}: Pick<
	BlogEditorState,
	| 'editor'
	| 'onTitleChange'
	| 'onSlugChange'
	| 'value'
	| 'fieldErrors'
	| 'setCoverBusy'
	| 'coverRevision'
	| 'saving'
	| 'busy'
	| 'setField'
	| 'fieldProps'
	| 'fieldError'
>) {
	return (
		<FieldGroup>
			<Field data-invalid={!!fieldErrors.title}>
				<FieldLabel htmlFor="blog-title">Title</FieldLabel>
				<Input
					id="blog-title"
					maxLength={200}
					value={value.title}
					disabled={busy}
					{...fieldProps('title')}
					onChange={(event) => onTitleChange(event.target.value)}
				/>
				{fieldError('title')}
			</Field>
			<Field data-invalid={!!fieldErrors.slug}>
				<FieldLabel htmlFor="blog-slug">Slug</FieldLabel>
				<Input
					id="blog-slug"
					maxLength={160}
					value={value.slug}
					disabled={busy}
					{...fieldProps('slug')}
					onChange={(event) => onSlugChange(event.target.value)}
				/>
				<FieldDescription>
					Public URL: /blogs/{value.slug || 'your-post-slug'}. Generated from
					the title until you customize it.
				</FieldDescription>
				{fieldError('slug')}
			</Field>
			<Field data-invalid={!!fieldErrors.description}>
				<FieldLabel htmlFor="blog-description">Description</FieldLabel>
				<Textarea
					id="blog-description"
					maxLength={500}
					value={value.description}
					disabled={busy}
					{...fieldProps('description')}
					onChange={(event) => setField('description', event.target.value)}
				/>
				<FieldDescription>
					A short summary for the blog card and article introduction.
				</FieldDescription>
				{fieldError('description')}
			</Field>
			<Field data-invalid={!!fieldErrors.coverUrl}>
				<FieldLabel>Cover image</FieldLabel>
				<BlogCoverInput
					key={coverRevision}
					value={value.coverUrl}
					onChange={(coverUrl) => setField('coverUrl', coverUrl)}
					onBusyChange={setCoverBusy}
					disabled={saving}
					invalid={!!fieldErrors.coverUrl}
					errorId={fieldErrors.coverUrl ? 'blog-coverUrl-error' : undefined}
				/>
				{fieldError('coverUrl')}
			</Field>
			<Field data-invalid={!!fieldErrors.content}>
				<FieldLabel id="blog-content-label">Content (Markdown)</FieldLabel>
				<fieldset
					id="blog-content"
					aria-labelledby="blog-content-label"
					{...fieldProps('content')}
					tabIndex={-1}
					inert={saving}
					className="min-w-0 rounded-lg border p-4 sm:p-5"
				>
					<ClientOnly
						fallback={
							<div className="flex min-h-40 flex-col gap-3">
								<output>Loading editor…</output>
								<Skeleton className="h-4 w-3/4" />
								<Skeleton className="h-4 w-1/2" />
							</div>
						}
					>
						<BlockNoteEditor
							ref={editor}
							value={value.content}
							onChange={(content) => setField('content', content)}
						/>
					</ClientOnly>
				</fieldset>
				<FieldDescription>
					Use ## headings for sections and ### for subsections. The table of
					contents and read time are generated automatically. Estimated read
					time: {blogReadTime(value.content)} min.
				</FieldDescription>
				{fieldError('content')}
			</Field>
			<Field>
				<FieldLabel htmlFor="blog-status">Status</FieldLabel>
				<NativeSelect
					id="blog-status"
					value={value.status}
					disabled={busy}
					onChange={(event) =>
						setField(
							'status',
							event.target.value === 'published' ? 'published' : 'draft'
						)
					}
				>
					<NativeSelectOption value="draft">Draft</NativeSelectOption>
					<NativeSelectOption value="published">Published</NativeSelectOption>
				</NativeSelect>
				<FieldDescription>
					Drafts are only visible to admins. Publishing makes the post available
					at its public URL.
				</FieldDescription>
			</Field>
		</FieldGroup>
	)
}

function BlogContentPreview({
	editor,
	value,
}: {
	editor: React.RefObject<BlockNoteEditorHandle | null>
	value: BlogBody
}) {
	return (
		<Collapsible
			onOpenChange={(open) => {
				if (open) editor.current?.flush()
			}}
		>
			<CollapsibleTrigger render={<Button type="button" variant="outline" />}>
				Preview content
			</CollapsibleTrigger>
			<CollapsibleContent>
				<section
					aria-label="Markdown preview"
					className="mt-4 min-w-0 rounded-lg border p-4 sm:p-6"
				>
					{value.content.trim() ? (
						<PublicContent
							slug={`blogs/${value.slug || 'preview'}`}
							content={value.content}
							headingMode="article"
						/>
					) : (
						<p className="text-sm text-muted-foreground">
							Write some content to preview it here.
						</p>
					)}
				</section>
			</CollapsibleContent>
		</Collapsible>
	)
}
