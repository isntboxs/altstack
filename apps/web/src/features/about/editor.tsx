import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ClientOnly, Link, useBlocker, useRouter } from '@tanstack/react-router'
import { useRef, useState } from 'react'

import { aboutBodySchema } from '@altstack/shared/schemas'
import type { AboutBody, AboutPage } from '@altstack/shared/schemas'

import {
	Alert,
	AlertDescription,
	AlertTitle,
} from '@altstack/ui/components/alert'
import { Button, buttonVariants } from '@altstack/ui/components/button'
import {
	Collapsible,
	CollapsibleTrigger,
	CollapsibleContent,
} from '@altstack/ui/components/collapsible'
import {
	Field,
	FieldGroup,
	FieldLabel,
	FieldDescription,
	FieldError,
} from '@altstack/ui/components/field'
import { Input } from '@altstack/ui/components/input'
import { Textarea } from '@altstack/ui/components/textarea'

import { ActionConfirmation } from '#/components/action-confirmation'
import BlockNoteEditor from '#/components/block-note/editor'
import type { BlockNoteEditorHandle } from '#/components/block-note/editor'
import { canSaveEditorContent } from '#/components/block-note/upload-image'
import { PublicContent } from '#/components/public-content'
import { aboutQueries } from '#/features/about/queries'
import { orpc } from '#/utils/orpc'

function bodyOf(page: AboutPage): AboutBody {
	return {
		title: page.title,
		description: page.description,
		content: page.content,
	}
}

export function AboutEditor({ initial }: { initial: AboutPage }) {
	const [value, setValue] = useState(() => bodyOf(initial))
	const [version, setVersion] = useState(initial.version)
	const [baseline, setBaseline] = useState(() => bodyOf(initial))
	const editor = useRef<BlockNoteEditorHandle>(null)
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
	const [saved, setSaved] = useState(false)
	const [reloading, setReloading] = useState(false)
	const [reloadError, setReloadError] = useState('')
	const queryClient = useQueryClient()
	const router = useRouter()
	const update = useMutation(orpc.admin.about.update.mutationOptions())
	const busy = update.isPending || reloading
	const dirty = JSON.stringify(value) !== JSON.stringify(baseline)
	const blocker = useBlocker({
		shouldBlockFn: () => dirty,
		enableBeforeUnload: () => dirty,
		withResolver: true,
	})
	const conflict =
		update.error && 'code' in update.error && update.error.code === 'CONFLICT'

	function setField<K extends keyof AboutBody>(field: K, next: AboutBody[K]) {
		setSaved(false)
		setValue((previous) => {
			return { ...previous, [field]: next }
		})
	}

	async function submit() {
		if (busy) return
		if (!canSaveEditorContent(editor.current)) return
		const current = {
			...value,
			content: editor.current?.readMarkdown() ?? value.content,
		}
		setValue(current)
		const parsed = aboutBodySchema.safeParse(current)
		if (!parsed.success) {
			const errors: Record<string, string> = {}
			for (const issue of parsed.error.issues) {
				const field = String(issue.path[0])
				errors[field] = errors[field] ?? issue.message
			}
			setFieldErrors(errors)
			return
		}
		setFieldErrors({})
		setSaved(false)
		try {
			const page = await update.mutateAsync({
				body: { ...parsed.data, expectedVersion: version },
			})
			setBaseline(bodyOf(page))
			setValue(bodyOf(page))
			setVersion(page.version)
			queryClient.setQueryData(aboutQueries.admin().queryKey, page)
			queryClient.setQueryData(aboutQueries.get().queryKey, page)
			await queryClient.invalidateQueries({ queryKey: orpc.about.key() })
			setSaved(true)
		} catch {
			// The mutation error is displayed below; keep the current edits for retry.
		}
	}

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-6 sm:px-6">
			<header className="flex flex-wrap items-start justify-between gap-4">
				<div className="flex flex-col gap-2">
					<h1 className="text-2xl font-semibold">About us</h1>
					<p className="max-w-2xl text-sm text-muted-foreground">
						Tell visitors what AltStack is and how to take part. Saved changes
						appear on the public page immediately.
					</p>
				</div>
				<Link to="/about" className={buttonVariants({ variant: 'outline' })}>
					View public page
				</Link>
			</header>
			{update.error && (
				<Alert variant="destructive" role="alert">
					<AlertTitle>Unable to save About us</AlertTitle>
					<AlertDescription>{update.error.message}</AlertDescription>
					{conflict && (
						<Button
							type="button"
							variant="outline"
							disabled={busy}
							onClick={async () => {
								if (reloading) return
								setReloading(true)
								setReloadError('')
								try {
									await router.invalidate()
								} catch {
									setReloadError(
										'Unable to reload. Your edits are still here. Please try again.'
									)
								}
								setReloading(false)
							}}
						>
							Discard edits and reload
						</Button>
					)}
				</Alert>
			)}
			{reloadError && <p role="alert">{reloadError}</p>}
			{saved && (
				<output className="text-sm">
					About us saved. Your changes are live.
				</output>
			)}
			<form action={submit} className="flex min-w-0 flex-col gap-6">
				<AboutFields
					value={value}
					fieldErrors={fieldErrors}
					busy={busy}
					editor={editor}
					setField={setField}
				/>
				<Collapsible
					onOpenChange={(open) => {
						if (open) editor.current?.flush()
					}}
				>
					<CollapsibleTrigger
						render={<Button type="button" variant="outline" />}
					>
						Preview content
					</CollapsibleTrigger>
					<CollapsibleContent>
						<section
							aria-label="About preview"
							className="mt-4 min-w-0 rounded-lg border p-4 sm:p-6"
						>
							<PublicContent
								slug="about"
								content={value.content}
								headingMode="article"
							/>
						</section>
					</CollapsibleContent>
				</Collapsible>
				<div className="flex flex-wrap items-center justify-between gap-4 border-t pt-4">
					<p className="text-sm text-muted-foreground">
						{dirty ? 'You have unsaved changes.' : 'No unsaved changes.'}
					</p>
					<Button type="submit" disabled={busy}>
						{update.isPending ? 'Saving…' : 'Save changes'}
					</Button>
				</div>
			</form>
			<ActionConfirmation
				open={blocker.status === 'blocked'}
				title="Discard unsaved changes?"
				description="Your changes to About us have not been saved."
				pending={false}
				cancelLabel="Keep editing"
				confirmLabel="Discard changes"
				onClose={() => blocker.reset?.()}
				onConfirm={() => blocker.proceed?.()}
			/>
		</div>
	)
}

function AboutFields({
	value,
	fieldErrors,
	busy,
	editor,
	setField,
}: {
	value: AboutBody
	fieldErrors: Record<string, string>
	busy: boolean
	editor: React.RefObject<BlockNoteEditorHandle | null>
	setField: <K extends keyof AboutBody>(field: K, next: AboutBody[K]) => void
}) {
	return (
		<fieldset disabled={busy} className="min-w-0">
			<FieldGroup>
				<Field data-invalid={!!fieldErrors.title}>
					<FieldLabel htmlFor="about-title">Title</FieldLabel>
					<Input
						id="about-title"
						value={value.title}
						maxLength={200}
						aria-invalid={!!fieldErrors.title}
						aria-describedby={
							fieldErrors.title ? 'about-title-error' : undefined
						}
						onChange={(event) => setField('title', event.target.value)}
					/>
					{fieldErrors.title && (
						<FieldError id="about-title-error">{fieldErrors.title}</FieldError>
					)}
				</Field>
				<Field data-invalid={!!fieldErrors.description}>
					<FieldLabel htmlFor="about-description">Description</FieldLabel>
					<Textarea
						id="about-description"
						value={value.description}
						maxLength={500}
						rows={3}
						aria-invalid={!!fieldErrors.description}
						aria-describedby={
							fieldErrors.description
								? 'about-description-help about-description-error'
								: 'about-description-help'
						}
						onChange={(event) => setField('description', event.target.value)}
					/>
					<FieldDescription id="about-description-help">
						Shown below the title and used in search and social previews.
					</FieldDescription>
					{fieldErrors.description && (
						<FieldError id="about-description-error">
							{fieldErrors.description}
						</FieldError>
					)}
				</Field>
				<Field data-invalid={!!fieldErrors.content}>
					<FieldLabel id="about-content-label">Content (Markdown)</FieldLabel>
					<fieldset
						inert={busy}
						aria-labelledby="about-content-label"
						aria-describedby={
							fieldErrors.content
								? 'about-content-help about-content-error'
								: 'about-content-help'
						}
						className="min-h-40 min-w-0 rounded-lg border p-4 sm:p-5"
					>
						<ClientOnly fallback={<output>Loading editor…</output>}>
							<BlockNoteEditor
								ref={editor}
								value={value.content}
								onChange={(content) => setField('content', content)}
							/>
						</ClientOnly>
					</fieldset>
					<FieldDescription id="about-content-help">
						Use headings, lists, and links to organize the page. Start sections
						with a level 2 heading.
					</FieldDescription>
					{fieldErrors.content && (
						<FieldError id="about-content-error">
							{fieldErrors.content}
						</FieldError>
					)}
				</Field>
			</FieldGroup>
		</fieldset>
	)
}
