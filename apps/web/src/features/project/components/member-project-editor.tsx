import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ClientOnly, useRouter } from '@tanstack/react-router'
import { useId, useMemo, useRef, useState } from 'react'

import type { ORPCRouterOutputs } from '@altstack/api/routers'

import { memberProjectUpdateBodySchema } from '@altstack/shared/schemas/ownership'

import { Alert, AlertDescription } from '@altstack/ui/components/alert'
import { Button } from '@altstack/ui/components/button'
import { Field, FieldGroup, FieldLabel } from '@altstack/ui/components/field'
import { Input } from '@altstack/ui/components/input'
import { Spinner } from '@altstack/ui/components/spinner'
import { Textarea } from '@altstack/ui/components/textarea'
import { toast } from '@altstack/ui/components/toast'

import BlockNoteEditor from '#/components/block-note/editor'
import type { BlockNoteEditorHandle } from '#/components/block-note/editor'
import { CategoryComboboxView } from '#/components/category-combobox-view'
import { LogoUploader, ScreenshotUploader } from '#/components/image-uploader'
import { memberUploadApi, ownershipKey } from '#/features/project/ownership'
import { invalidateCatalog } from '#/utils/invalidate-catalog'
import { client } from '#/utils/orpc'
import { resolveFileUrl } from '#/utils/storage'

export function MemberProjectEditor({
	project,
	categories,
}: {
	project: ORPCRouterOutputs['ownership']['get']
	categories: ORPCRouterOutputs['ownership']['categories']['categories']
}) {
	const id = useId(),
		router = useRouter(),
		queryClient = useQueryClient()
	const [name, setName] = useState(project.name),
		[tagline, setTagline] = useState(project.tagline),
		[description, setDescription] = useState(project.description),
		[websiteUrl, setWebsiteUrl] = useState(project.websiteUrl ?? ''),
		[content, setContent] = useState(project.content ?? '')
	const [categorySlugs, setCategorySlugs] = useState(project.categorySlugs)
	const [logo, setLogo] = useState<string | null>(),
		[screenshot, setScreenshot] = useState<string | null>()
	const [error, setError] = useState('')
	const editor = useRef<BlockNoteEditorHandle>(null),
		saving = useRef(false)
	const logoApi = useMemo(
		() => memberUploadApi(project.id, 'logo'),
		[project.id]
	)
	const screenshotApi = useMemo(
		() => memberUploadApi(project.id, 'screenshot'),
		[project.id]
	)
	const mutation = useMutation({
		mutationFn: (body: Parameters<typeof client.ownership.update>[0]['body']) =>
			client.ownership.update({ params: { id: project.id }, body }),
		retry: false,
	})
	async function save(event: React.SyntheticEvent) {
		event.preventDefault()
		if (saving.current) return
		const parsed = memberProjectUpdateBodySchema.safeParse({
			revision: project.revision,
			name,
			tagline,
			description,
			websiteUrl: websiteUrl.trim() || null,
			content: editor.current?.readMarkdown() ?? content,
			categorySlugs,
			...(logo === undefined ? {} : { logo }),
			...(screenshot === undefined ? {} : { screenshot }),
		})
		if (!parsed.success) {
			setError(parsed.error.issues.map((issue) => issue.message).join('; '))
			return
		}
		saving.current = true
		setError('')
		try {
			await mutation.mutateAsync(parsed.data)
			toast.add({
				type: 'success',
				title: 'Project updated',
				description: 'Your changes are now public.',
			})
			await invalidateCatalog(queryClient)
			await queryClient.invalidateQueries({ queryKey: ownershipKey })
			await router.invalidate()
		} catch (reason) {
			setError(
				reason instanceof Error
					? reason.message
					: 'Unable to update the project. Please try again.'
			)
			if (
				reason &&
				typeof reason === 'object' &&
				'code' in reason &&
				(reason.code === 'UPLOAD_CONSUMED' || reason.code === 'UPLOAD_EXPIRED')
			) {
				setLogo(undefined)
				setScreenshot(undefined)
			}
		} finally {
			saving.current = false
		}
	}
	return (
		<form
			onSubmit={save}
			className="flex min-w-0 flex-col gap-6"
			aria-busy={mutation.isPending}
		>
			<fieldset
				disabled={mutation.isPending}
				className="flex min-w-0 flex-col gap-6"
			>
				<FieldGroup>
					<Field>
						<FieldLabel htmlFor={`${id}-name`}>Project name</FieldLabel>
						<Input
							id={`${id}-name`}
							value={name}
							onChange={(event) => setName(event.target.value)}
							required
							minLength={2}
							maxLength={100}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor={`${id}-tagline`}>Tagline</FieldLabel>
						<Input
							id={`${id}-tagline`}
							value={tagline}
							onChange={(event) => setTagline(event.target.value)}
							required
							maxLength={100}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor={`${id}-description`}>Description</FieldLabel>
						<Textarea
							id={`${id}-description`}
							value={description}
							onChange={(event) => setDescription(event.target.value)}
							required
							maxLength={300}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor={`${id}-website`}>Website URL</FieldLabel>
						<Input
							id={`${id}-website`}
							type="url"
							value={websiteUrl}
							onChange={(event) => setWebsiteUrl(event.target.value)}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor={`${id}-categories`}>Categories</FieldLabel>
						<CategoryComboboxView
							id={`${id}-categories`}
							value={categorySlugs}
							onValueChange={setCategorySlugs}
							categories={categories}
						/>
					</Field>
				</FieldGroup>
				<div className="grid min-w-0 gap-6 sm:grid-cols-[14rem_minmax(0,1fr)]">
					<Field>
						<FieldLabel>Project logo</FieldLabel>
						<LogoUploader
							api={logoApi}
							value={logo ?? undefined}
							existingUrl={logo === null ? null : resolveFileUrl(project.logo)}
							onChange={setLogo}
							onRemoveExisting={() => setLogo(null)}
						/>
					</Field>
					<Field>
						<FieldLabel>Project screenshot</FieldLabel>
						<ScreenshotUploader
							api={screenshotApi}
							value={screenshot ?? undefined}
							existingUrl={
								screenshot === null ? null : resolveFileUrl(project.screenshot)
							}
							onChange={setScreenshot}
							onRemoveExisting={() => setScreenshot(null)}
						/>
					</Field>
				</div>
				<Field>
					<FieldLabel>Project content</FieldLabel>
					<ClientOnly>
						<BlockNoteEditor
							ref={editor}
							value={content}
							onChange={setContent}
						/>
					</ClientOnly>
				</Field>
			</fieldset>
			{error && (
				<Alert variant="destructive">
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}
			<div className="flex flex-wrap gap-3">
				<Button type="submit" disabled={mutation.isPending}>
					{mutation.isPending && <Spinner />}
					{mutation.isPending ? 'Publishing…' : 'Publish changes'}
				</Button>
				<Button
					type="button"
					variant="outline"
					disabled={mutation.isPending}
					onClick={() =>
						void queryClient.invalidateQueries({ queryKey: ownershipKey })
					}
				>
					Reload project
				</Button>
			</div>
		</form>
	)
}
