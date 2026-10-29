import { IconArrowDown, IconArrowUp } from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
	ClientOnly,
	Link,
	useNavigate,
	useRouter,
} from '@tanstack/react-router'
import { useRef, useState } from 'react'

import type { ORPCRouterOutputs } from '@altstack/api/routers'

import {
	collectionBodySchema,
	collectionKindLabels,
	collectionKinds,
} from '@altstack/shared/schemas/collection'
import type { CollectionBody } from '@altstack/shared/schemas/collection'

import {
	Alert,
	AlertDescription,
	AlertTitle,
} from '@altstack/ui/components/alert'
import { Button, buttonVariants } from '@altstack/ui/components/button'
import {
	Field,
	FieldGroup,
	FieldLabel,
	FieldDescription,
} from '@altstack/ui/components/field'
import { Input } from '@altstack/ui/components/input'
import {
	NativeSelect,
	NativeSelectOption,
} from '@altstack/ui/components/native-select'
import { Textarea } from '@altstack/ui/components/textarea'
import { toast } from '@altstack/ui/components/toast'

import BlockNoteEditor from '#/components/block-note/editor'
import type { BlockNoteEditorHandle } from '#/components/block-note/editor'
import { ProjectLogo } from '#/components/project-media'
import { PublicContent } from '#/components/public-content'
import { adminProjectQueries } from '#/features/admin-projects/queries'
import { orpc } from '#/utils/orpc'

type Initial = ORPCRouterOutputs['admin']['collection']['getById']
type Selected = {
	id: string
	name: string
	logo: string | null
	status: string
}
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
export function CollectionEditor({ initial }: { initial?: Initial }) {
	const queryClient = useQueryClient(),
		navigate = useNavigate(),
		router = useRouter()
	const editor = useRef<BlockNoteEditorHandle>(null)
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
	const [invalid, setInvalid] = useState<Array<string>>([])
	const [reloading, setReloading] = useState(false)
	const [editorRevision, setEditorRevision] = useState(0)

	const [members, setMembers] = useState<Array<Selected>>(
		initial?.projects ?? []
	)
	const [target, setTarget] = useState<Selected | null>(
		initial?.mainProject ?? null
	)
	const [error, setError] = useState(''),
		[preview, setPreview] = useState(false),
		[search, setSearch] = useState(''),
		[text, setText] = useState(''),
		[page, setPage] = useState(1)
	const candidates = useQuery({
		...adminProjectQueries.list({
			status: 'published',
			name: search || undefined,
			page,
			limit: 12,
		}),
		retry: false,
	})
	const create = useMutation(orpc.admin.collection.create.mutationOptions()),
		update = useMutation(orpc.admin.collection.update.mutationOptions())
	const busy = create.isPending || update.isPending || reloading
	async function save() {
		editor.current?.flush()
		const parsed = collectionBodySchema.safeParse({
			...value,
			content: editor.current?.readMarkdown() ?? value.content,
			projectIds: members.map((p) => p.id),
		})
		if (!parsed.success) {
			setInvalid(
				parsed.error.issues.flatMap((issue) =>
					issue.path.length > 0 ? [String(issue.path[0])] : []
				)
			)
			setError(
				parsed.error.issues
					.map((i) => `${i.path.join('.') || 'Collection'}: ${i.message}`)
					.join(' ')
			)
			return
		}
		setError('')
		setInvalid([])
		try {
			if (initial) {
				await update.mutateAsync({
					params: { id: initial.id },
					body: { ...parsed.data, expectedVersion: initial.version },
				})
			} else await create.mutateAsync({ body: parsed.data })
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: orpc.admin.collection.key(),
				}),
				queryClient.invalidateQueries({ queryKey: orpc.collection.key() }),
			])
			toast.add({ type: 'success', title: 'Collection saved' })
			await navigate({ to: '/admin/collections' })
		} catch (err) {
			setError(
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
			setInvalid([])
			setPreview(false)
		} catch {
			setError('Unable to reload. Your edits have been kept.')
		} finally {
			setReloading(false)
		}
	}
	function move(index: number, delta: number) {
		setMembers((previous) => {
			const next = [...previous]
			;[next[index], next[index + delta]] = [next[index + delta], next[index]]
			return next
		})
	}
	return (
		<div className="mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-6 p-4 sm:p-6">
			<Link to="/admin/collections" className="underline underline-offset-4">
				Collections
			</Link>
			<h1 className="text-2xl font-semibold">
				{initial ? 'Edit collection' : 'Create collection'}
			</h1>
			{initial && (
				<p className="text-sm text-muted-foreground">
					Written by {initial.authorName}. Authorship stays with the original
					writer.
				</p>
			)}
			{error && (
				<Alert id="collection-errors" variant="destructive">
					<AlertTitle>Unable to save collection</AlertTitle>
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}
			<form
				onSubmit={(e) => {
					e.preventDefault()
					void save()
				}}
				className="flex flex-col gap-6"
			>
				<fieldset disabled={busy} className="min-w-0">
					<FieldGroup>
						<Field data-invalid={invalid.includes('name')}>
							<FieldLabel htmlFor="collection-name">Title</FieldLabel>
							<Input
								id="collection-name"
								aria-invalid={invalid.includes('name')}
								aria-describedby={error ? 'collection-errors' : undefined}
								required
								maxLength={120}
								value={value.name}
								onChange={(e) => setValue({ ...value, name: e.target.value })}
							/>
						</Field>
						<Field data-invalid={invalid.includes('slug')}>
							<FieldLabel htmlFor="collection-slug">Slug</FieldLabel>
							<Input
								id="collection-slug"
								aria-invalid={invalid.includes('slug')}
								aria-describedby={error ? 'collection-errors' : undefined}
								required
								maxLength={100}
								pattern="[a-z0-9]+(-[a-z0-9]+)*"
								value={value.slug}
								onChange={(e) => setValue({ ...value, slug: e.target.value })}
							/>
							<FieldDescription>
								Public URL: /collections/{value.slug || 'your-slug'}. Changing
								it changes the URL.
							</FieldDescription>
						</Field>
						<Field data-invalid={invalid.includes('description')}>
							<FieldLabel htmlFor="collection-description">
								Description
							</FieldLabel>
							<Textarea
								id="collection-description"
								aria-invalid={invalid.includes('description')}
								aria-describedby={error ? 'collection-errors' : undefined}
								required
								maxLength={300}
								value={value.description}
								onChange={(e) =>
									setValue({ ...value, description: e.target.value })
								}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="collection-kind">Type</FieldLabel>
							<NativeSelect
								id="collection-kind"
								value={value.kind}
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
						</Field>
						{value.kind === 'repository' ? (
							<Field data-invalid={invalid.includes('sourceRepositoryUrl')}>
								<FieldLabel htmlFor="collection-source">
									Source repository URL
								</FieldLabel>
								<Input
									id="collection-source"
									aria-invalid={invalid.includes('sourceRepositoryUrl')}
									aria-describedby={error ? 'collection-errors' : undefined}
									type="url"
									required
									value={value.sourceRepositoryUrl ?? ''}
									placeholder="https://github.com/owner/repository"
									onChange={(e) =>
										setValue({ ...value, sourceRepositoryUrl: e.target.value })
									}
								/>
								<FieldDescription>
									The source list does not need an AltStack project. Membership
									is maintained manually.
								</FieldDescription>
							</Field>
						) : (
							<Field>
								<FieldLabel>Main project</FieldLabel>
								<p>
									{target
										? `${target.name} (${target.status})`
										: 'Choose a published project in the selector below.'}
								</p>
								<FieldDescription>
									A hidden or deleted main project makes this collection
									unavailable publicly.
								</FieldDescription>
							</Field>
						)}
						<Field>
							<FieldLabel htmlFor="collection-status">Publication</FieldLabel>
							<NativeSelect
								id="collection-status"
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
							<FieldDescription>
								Publishing requires at least one published member. Unavailable
								members are omitted publicly; remove them before saving.
							</FieldDescription>
						</Field>
						<Field>
							<FieldLabel>Markdown content</FieldLabel>
							<ClientOnly fallback={<p>Loading editor…</p>}>
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
							<Button
								type="button"
								variant="outline"
								onClick={() => {
									editor.current?.flush()
									setValue((previous) => {
										return {
											...previous,
											content:
												editor.current?.readMarkdown() ?? previous.content,
										}
									})
									setPreview(!preview)
								}}
							>
								{preview ? 'Hide public preview' : 'Show public preview'}
							</Button>
							{preview && (
								<PublicContent
									slug={`collections/${value.slug}`}
									content={value.content}
								/>
							)}
						</Field>
					</FieldGroup>
				</fieldset>
				<section
					aria-labelledby="collection-members-title"
					className="flex flex-col gap-4"
				>
					<h2 id="collection-members-title" className="text-lg font-semibold">
						Members ({members.length}/100)
					</h2>
					<p className="text-sm text-muted-foreground">
						Order controls presentation only; it is not a ranking.
					</p>
					<ol className="flex flex-col gap-3">
						{members.map((member, index) => (
							<li
								key={member.id}
								className="flex flex-wrap items-center gap-2 rounded-md border p-3"
							>
								<span>{index + 1}.</span>
								<ProjectLogo
									src={member.logo}
									name={member.name}
									className="size-7"
								/>
								<span className="mr-auto">
									{member.name}
									{member.status !== 'published' &&
										' — unavailable, remove before saving'}
								</span>
								<Button
									type="button"
									variant="outline"
									size="icon"
									aria-label={`Move ${member.name} up`}
									disabled={busy || index === 0}
									onClick={() => move(index, -1)}
								>
									<IconArrowUp />
								</Button>
								<Button
									type="button"
									variant="outline"
									size="icon"
									aria-label={`Move ${member.name} down`}
									disabled={busy || index === members.length - 1}
									onClick={() => move(index, 1)}
								>
									<IconArrowDown />
								</Button>
								<Button
									type="button"
									variant="outline"
									disabled={busy}
									onClick={() =>
										setMembers(members.filter((p) => p.id !== member.id))
									}
								>
									Remove<span className="sr-only"> {member.name}</span>
								</Button>
							</li>
						))}
					</ol>
				</section>
				<div className="flex flex-wrap gap-3">
					<Button type="submit" disabled={busy}>
						{busy ? 'Saving…' : 'Save collection'}
					</Button>
					{initial && (
						<Button
							type="button"
							variant="outline"
							disabled={busy}
							onClick={() => void reload()}
						>
							Discard and reload
						</Button>
					)}
					<Link
						to="/admin/collections"
						className={buttonVariants({ variant: 'outline' })}
					>
						Cancel
					</Link>
				</div>
			</form>
			<section
				aria-label="Project selector"
				className="flex min-w-0 flex-col gap-4"
			>
				<h2 className="text-lg font-semibold">Choose listed projects</h2>
				<form
					onSubmit={(e) => {
						e.preventDefault()
						setSearch(text.trim())
						setPage(1)
					}}
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="collection-project-search">
								Search published projects
							</FieldLabel>
							<div className="flex gap-2">
								<Input
									id="collection-project-search"
									value={text}
									onChange={(e) => setText(e.target.value)}
								/>
								<Button type="submit" variant="outline">
									Search
								</Button>
							</div>
						</Field>
					</FieldGroup>
				</form>
				{candidates.isPending && <output>Loading projects…</output>}
				{candidates.isError && (
					<Alert variant="destructive">
						<AlertTitle>Unable to load projects</AlertTitle>
						<AlertDescription>
							<Button
								variant="outline"
								onClick={() => void candidates.refetch()}
							>
								Retry search
							</Button>
						</AlertDescription>
					</Alert>
				)}
				<ul className="flex flex-col gap-2">
					{candidates.data?.projects.map((p) => (
						<li
							key={p.id}
							className="flex flex-wrap items-center gap-3 rounded-md border p-3"
						>
							<ProjectLogo src={p.logo} name={p.name} className="size-7" />
							<span className="mr-auto min-w-0 wrap-anywhere">{p.name}</span>
							{value.kind !== 'repository' && (
								<Button
									variant="outline"
									disabled={
										busy ||
										members.some((m) => m.id === p.id) ||
										target?.id === p.id
									}
									onClick={() => {
										setTarget(p)
										setValue({ ...value, mainProjectId: p.id })
									}}
								>
									Set main project
								</Button>
							)}
							<Button
								variant="outline"
								disabled={
									busy ||
									members.length >= 100 ||
									members.some((m) => m.id === p.id) ||
									target?.id === p.id
								}
								onClick={() => setMembers([...members, p])}
							>
								{members.some((m) => m.id === p.id) ? 'Added' : 'Add member'}
							</Button>
						</li>
					))}
				</ul>
				{candidates.data?.projects.length === 0 && (
					<p>
						No matching projects. Submit missing projects through the existing
						workflow.
					</p>
				)}
				<div className="flex gap-3">
					<Button
						variant="outline"
						disabled={!candidates.data?.pagination.hasPreviousPage}
						onClick={() => setPage(page - 1)}
					>
						Previous
					</Button>
					<span className="self-center text-sm">Page {page}</span>
					<Button
						variant="outline"
						disabled={!candidates.data?.pagination.hasNextPage}
						onClick={() => setPage(page + 1)}
					>
						Next
					</Button>
				</div>
				<Link to="/submit" className="w-fit underline underline-offset-4">
					Submit a missing project
				</Link>
			</section>
		</div>
	)
}
