import { useForm } from '@tanstack/react-form-start'
import { ClientOnly } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import type { z } from 'zod'

import { slugify } from '@altstack/shared/lib/slug'
import { adminCreateProjectBodySchema } from '@altstack/shared/schemas/admin-project'

import { Button } from '@altstack/ui/components/button'
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from '@altstack/ui/components/field'
import { Input } from '@altstack/ui/components/input'
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	InputGroupText,
} from '@altstack/ui/components/input-group'
import {
	NativeSelect,
	NativeSelectOption,
} from '@altstack/ui/components/native-select'
import { Spinner } from '@altstack/ui/components/spinner'
import { toast } from '@altstack/ui/components/toast'

import BlockNoteEditor from '#/components/block-note/editor'
import type { BlockNoteEditorHandle } from '#/components/block-note/editor'
import { canSaveEditorContent } from '#/components/block-note/upload-image'
import { LogoUploader, ScreenshotUploader } from '#/components/image-uploader'
import { GithubMetadataPrefill } from '#/features/admin-projects/components/github-metadata-prefill'
import { GithubReadmeImport } from '#/features/admin-projects/components/github-readme-import'
import {
	ProjectDescriptionSection,
	ProjectCopyField,
	ProjectCategoriesSection,
} from '#/features/admin-projects/components/project-form-fields'
import { ProjectFormHeader } from '#/features/admin-projects/components/project-form-header'
import {
	ProjectPreviewCard,
	ProjectPreviewPanel,
	SectionHeading,
} from '#/features/admin-projects/components/project-form-preview'
import { useAdminProjectCreate } from '#/features/admin-projects/queries'

const defaultValues: z.input<typeof adminCreateProjectBodySchema> = {
	name: '',
	slug: '',
	repositoryUrl: '',
	tagline: '',
	description: '',
	logo: undefined,
	screenshot: undefined,
	websiteUrl: undefined,
	content: undefined,
	categorySlugs: [],
	// Explicit default: new projects publish immediately unless saved as
	// draft (hidden from the public catalogue). Mirrors the
	// `.default('published')` in adminCreateProjectBodySchema.
	status: 'published',
}

function isUploadExpiredError(error: unknown): boolean {
	return (
		typeof error === 'object' &&
		error !== null &&
		'code' in error &&
		(error as { code?: unknown }).code === 'UPLOAD_EXPIRED'
	)
}

function isPromotionConflictError(error: unknown): boolean {
	return (
		typeof error === 'object' &&
		error !== null &&
		'code' in error &&
		(error as { code?: unknown }).code === 'CONFLICT_AFTER_PROMOTE'
	)
}

function isUploadConsumedError(error: unknown): boolean {
	return (
		typeof error === 'object' &&
		error !== null &&
		'code' in error &&
		(error as { code?: unknown }).code === 'UPLOAD_CONSUMED'
	)
}

function useCreateProjectForm() {
	const createProject = useAdminProjectCreate()
	const [submitError, setSubmitError] = useState<string | null>(null)
	const [logoDisplayUrl, setLogoDisplayUrl] = useState<string | null>(null)
	const [screenshotDisplayUrl, setScreenshotDisplayUrl] = useState<
		string | null
	>(null)

	const form = useForm({
		defaultValues,
		validators: {
			onChange: adminCreateProjectBodySchema,
			onSubmit: adminCreateProjectBodySchema,
		},
		onSubmit: async ({ value, formApi }) => {
			setSubmitError(null)
			try {
				await createProject.mutateAsync({ body: value })
			} catch (error) {
				setSubmitError(
					error instanceof Error ? error.message : 'Unable to save project.'
				)
				if (
					isUploadExpiredError(error) ||
					isPromotionConflictError(error) ||
					isUploadConsumedError(error)
				) {
					// Promote deletes tmp keys before the DB insert, so a failed
					// submit leaves the form holding dead keys — clear them so
					// retry starts from re-upload instead of failing again.
					// This covers UPLOAD_EXPIRED, post-promote conflict, and
					// failures after partial promotion. Preflight CONFLICT and
					// plain BAD_REQUEST (repository URL, category validation)
					// keep the uploaded images.
					formApi.setFieldValue('logo', undefined)
					formApi.setFieldValue('screenshot', undefined)
					setLogoDisplayUrl(null)
					setScreenshotDisplayUrl(null)
					toast.add({
						type: 'warning',
						title: 'Images need re-upload',
						description:
							'The uploaded images expired when the submit failed. Please upload them again and retry.',
					})
				}
				return
			}
			formApi.reset()
			isSlugCustomized.current = false
			setLogoDisplayUrl(null)
			setScreenshotDisplayUrl(null)
		},
	})

	// Once the user edits the slug by hand, auto-fill from name stops.
	const isSlugCustomized = useRef(false)

	// Flushes the editor's deferred markdown export so handleSubmit below
	// reads the latest content even when submit lands in the same task as
	// the last keystroke.
	const editorRef = useRef<BlockNoteEditorHandle | null>(null)

	return {
		createProject,
		submitError,
		logoDisplayUrl,
		setLogoDisplayUrl,
		screenshotDisplayUrl,
		setScreenshotDisplayUrl,
		form,
		isSlugCustomized,
		editorRef,
	}
}

export function CreateProjectForm() {
	const controller = useCreateProjectForm()
	const { submitError, form, editorRef } = controller

	return (
		<div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6">
			<ProjectFormHeader
				title="Create project"
				description="Add a new project to the catalogue. The preview updates as you type."
			/>

			<div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
				<form
					id="create-project-form"
					className="min-w-0"
					onSubmit={(e) => {
						e.preventDefault()
						if (!canSaveEditorContent(editorRef.current)) return
						editorRef.current?.flush()
						void form.handleSubmit()
					}}
				>
					<div className="space-y-8">
						<CreateProjectBasics {...controller} />

						<CreateProjectDescription {...controller} />

						<CreateProjectContent {...controller} />

						<CreateProjectMedia {...controller} />

						<CreateProjectCategories {...controller} />

						<CreateProjectPublishing {...controller} />

						{submitError && (
							<p role="alert" className="text-sm text-destructive">
								{submitError} Your project fields and category selections are
								preserved. If a category changed, review its leaf status and
								retry.
							</p>
						)}
						<FieldGroup>
							<Field orientation="horizontal">
								{/* canSubmit/isPristine/isSubmitting live in the form store
									(useSyncExternalStore). Async validation can settle them
									during SSR streaming, so the server snapshot diverges from
									the client's first render (hydration mismatch on `disabled`
									and button content). Render a static fallback until
									hydrated, same as the editor above. */}
								<ClientOnly
									fallback={
										<Button type="submit" disabled className="w-full">
											Submit
										</Button>
									}
								>
									<form.Subscribe
										selector={(state) => [
											state.canSubmit,
											state.isPristine,
											state.isSubmitting,
										]}
										children={([canSubmit, isPristine, isSubmitting]) => (
											<Button
												type="submit"
												disabled={!canSubmit || isPristine}
												className="w-full"
											>
												{isSubmitting ? (
													<>
														<Spinner />
														Submitting...
													</>
												) : (
													'Submit'
												)}
											</Button>
										)}
									/>
								</ClientOnly>
							</Field>
						</FieldGroup>
					</div>
				</form>

				<CreateProjectPreview {...controller} />
			</div>
		</div>
	)
}

type CreateProjectFormState = ReturnType<typeof useCreateProjectForm>

function CreateProjectBasics({
	createProject,
	form,
	isSlugCustomized,
}: Pick<
	CreateProjectFormState,
	'createProject' | 'form' | 'isSlugCustomized'
>) {
	return (
		<section className="space-y-4">
			<SectionHeading
				title="Basics"
				description="Identity and links for the project."
			/>

			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<form.Field
					name="name"
					listeners={{
						onChange: ({ value }) => {
							if (!isSlugCustomized.current) {
								form.setFieldValue('slug', slugify(value), {
									dontUpdateMeta: true,
								})
							}
						},
					}}
					children={(field) => {
						const isInvalid =
							field.state.meta.isTouched && !field.state.meta.isValid

						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor={field.name}>Name</FieldLabel>

								<Input
									id={field.name}
									name={field.name}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									aria-invalid={isInvalid}
									placeholder="Name Project"
								/>

								{isInvalid && <FieldError errors={field.state.meta.errors} />}
							</Field>
						)
					}}
				/>

				<form.Field
					name="slug"
					children={(field) => {
						const isInvalid =
							field.state.meta.isTouched && !field.state.meta.isValid

						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor={field.name}>Slug</FieldLabel>

								<Input
									id={field.name}
									name={field.name}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => {
										isSlugCustomized.current = true
										field.handleChange(e.target.value)
									}}
									aria-invalid={isInvalid}
									placeholder="my-project"
									className="font-mono"
								/>

								<FieldDescription>
									Auto-filled from the name. Edit to customize.
								</FieldDescription>

								{isInvalid && <FieldError errors={field.state.meta.errors} />}
							</Field>
						)
					}}
				/>
			</div>

			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<form.Field
					name="repositoryUrl"
					children={(field) => {
						const isInvalid =
							field.state.meta.isTouched && !field.state.meta.isValid

						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor={field.name}>Repository URL</FieldLabel>
								<InputGroup>
									<InputGroupAddon className="h-full rounded-l-lg border-r bg-accent pr-1.5">
										<InputGroupText>https://github.com/</InputGroupText>
									</InputGroupAddon>
									<InputGroupInput
										id={field.name}
										name={field.name}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										aria-invalid={isInvalid}
										placeholder="owner/repository"
										className="font-mono"
									/>
								</InputGroup>

								<form.Subscribe
									selector={(state) =>
										[state.values.repositoryUrl, state.isSubmitting] as const
									}
								>
									{([repositoryUrl, isSubmitting]) => (
										<GithubMetadataPrefill
											repositoryUrl={repositoryUrl}
											disabled={isSubmitting || createProject.isPending}
											getCurrentValues={() => {
												return {
													repositoryUrl: form.getFieldValue('repositoryUrl'),
													description: form.getFieldValue('description'),
													websiteUrl: form.getFieldValue('websiteUrl'),
												}
											}}
											onApply={(values) => {
												if ('description' in values) {
													form.setFieldValue('description', values.description)
													void form.validateField('description', 'change')
												}
												if ('websiteUrl' in values) {
													form.setFieldValue('websiteUrl', values.websiteUrl)
													void form.validateField('websiteUrl', 'change')
												}
											}}
										/>
									)}
								</form.Subscribe>

								<FieldDescription>
									Must be a public, actively maintained repository with at least
									10 stars.
								</FieldDescription>

								{isInvalid && <FieldError errors={field.state.meta.errors} />}
							</Field>
						)
					}}
				/>

				<form.Field
					name="websiteUrl"
					children={(field) => {
						const isInvalid =
							field.state.meta.isTouched && !field.state.meta.isValid

						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor={field.name}>Website URL</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value ?? ''}
									onBlur={field.handleBlur}
									onChange={(e) => {
										const next = e.target.value
										field.handleChange(next === '' ? undefined : next)
									}}
									aria-invalid={isInvalid}
									placeholder="Website URL"
								/>

								{isInvalid && <FieldError errors={field.state.meta.errors} />}
							</Field>
						)
					}}
				/>
			</div>
		</section>
	)
}

function CreateProjectDescription({
	form,
}: Pick<CreateProjectFormState, 'form'>) {
	return (
		<ProjectDescriptionSection>
			<form.Field
				name="tagline"
				children={(field) => (
					<ProjectCopyField
						name={field.name}
						value={field.state.value}
						onBlur={field.handleBlur}
						onChange={(value) => field.handleChange(value)}
						invalid={field.state.meta.isTouched && !field.state.meta.isValid}
						errors={field.state.meta.errors}
					/>
				)}
			/>
			<form.Field
				name="description"
				children={(field) => (
					<ProjectCopyField
						name={field.name}
						value={field.state.value}
						onBlur={field.handleBlur}
						onChange={(value) => field.handleChange(value)}
						invalid={field.state.meta.isTouched && !field.state.meta.isValid}
						errors={field.state.meta.errors}
					/>
				)}
			/>
		</ProjectDescriptionSection>
	)
}

function CreateProjectContent({
	createProject,
	form,
	editorRef,
}: Pick<CreateProjectFormState, 'createProject' | 'form' | 'editorRef'>) {
	return (
		<section className="space-y-4">
			<SectionHeading
				title="Content"
				description="Type @ to mention a listed project, or find Project mention in the / menu."
			/>

			<form.Subscribe
				selector={(state) =>
					[state.values.repositoryUrl, state.isSubmitting] as const
				}
			>
				{([repositoryUrl, isSubmitting]) => (
					<ClientOnly>
						<GithubReadmeImport
							repositoryUrl={repositoryUrl}
							disabled={isSubmitting || createProject.isPending}
							getRepositoryUrl={() => form.getFieldValue('repositoryUrl')}
							getEditor={() => editorRef.current}
						/>
					</ClientOnly>
				)}
			</form.Subscribe>

			<form.Field
				name="content"
				children={(field) => {
					const isInvalid =
						field.state.meta.isTouched && !field.state.meta.isValid

					return (
						<Field data-invalid={isInvalid}>
							<ClientOnly>
								<BlockNoteEditor
									ref={editorRef}
									value={field.state.value ?? ''}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e)}
									className="rounded-lg border border-input bg-transparent px-2.5 py-2 transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
								/>
							</ClientOnly>

							{isInvalid && <FieldError errors={field.state.meta.errors} />}
						</Field>
					)
				}}
			/>
		</section>
	)
}

function CreateProjectMedia({
	setLogoDisplayUrl,
	setScreenshotDisplayUrl,
	form,
}: Pick<
	CreateProjectFormState,
	'setLogoDisplayUrl' | 'setScreenshotDisplayUrl' | 'form'
>) {
	return (
		<section className="@container/media space-y-4">
			<SectionHeading
				title="Media"
				description="Logo is required to publish. Screenshots are cropped to 16:9."
			/>

			<div className="grid grid-cols-1 items-start gap-4 @lg/media:grid-cols-[14rem_minmax(0,1fr)]">
				<form.Field
					name="logo"
					children={(field) => {
						const isInvalid =
							field.state.meta.isTouched && !field.state.meta.isValid

						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor={field.name}>Logo</FieldLabel>

								<LogoUploader
									value={field.state.value ?? ''}
									onChange={(next) =>
										field.handleChange(next === '' ? undefined : next)
									}
									onDisplayUrlChange={setLogoDisplayUrl}
								/>

								{isInvalid && <FieldError errors={field.state.meta.errors} />}
							</Field>
						)
					}}
				/>

				<form.Field
					name="screenshot"
					children={(field) => {
						const isInvalid =
							field.state.meta.isTouched && !field.state.meta.isValid

						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor={field.name}>Screenshot</FieldLabel>

								<ScreenshotUploader
									value={field.state.value ?? ''}
									onChange={(next) =>
										field.handleChange(next === '' ? undefined : next)
									}
									onDisplayUrlChange={setScreenshotDisplayUrl}
								/>

								<FieldDescription>
									Optional landing page capture in 16:9.
								</FieldDescription>

								{isInvalid && <FieldError errors={field.state.meta.errors} />}
							</Field>
						)
					}}
				/>
			</div>
		</section>
	)
}

function CreateProjectCategories({
	form,
}: Pick<CreateProjectFormState, 'form'>) {
	return (
		<form.Field
			name="categorySlugs"
			children={(field) => (
				<ProjectCategoriesSection
					id={field.name}
					value={field.state.value ?? []}
					onValueChange={(value) => field.handleChange(value)}
					invalid={field.state.meta.isTouched && !field.state.meta.isValid}
					errors={field.state.meta.errors}
				/>
			)}
		/>
	)
}

function CreateProjectPublishing({
	form,
}: Pick<CreateProjectFormState, 'form'>) {
	return (
		<section className="space-y-4">
			<SectionHeading
				title="Publishing"
				description="Draft projects stay hidden from the public catalogue."
			/>

			<form.Field
				name="status"
				children={(field) => {
					const isInvalid =
						field.state.meta.isTouched && !field.state.meta.isValid

					return (
						<Field data-invalid={isInvalid}>
							<FieldLabel htmlFor={field.name}>Status</FieldLabel>

							<NativeSelect
								id={field.name}
								name={field.name}
								value={field.state.value ?? 'published'}
								onBlur={field.handleBlur}
								onChange={(e) =>
									field.handleChange(e.target.value as 'draft' | 'published')
								}
								aria-invalid={isInvalid}
								className="w-full"
							>
								<NativeSelectOption value="draft">
									Draft — hidden from catalogue
								</NativeSelectOption>
								<NativeSelectOption value="published">
									Published — visible in catalogue
								</NativeSelectOption>
							</NativeSelect>

							<FieldDescription>
								New projects publish immediately unless saved as draft.
							</FieldDescription>

							{isInvalid && <FieldError errors={field.state.meta.errors} />}
						</Field>
					)
				}}
			/>
		</section>
	)
}

function CreateProjectPreview({
	logoDisplayUrl,
	screenshotDisplayUrl,
	form,
}: Pick<
	CreateProjectFormState,
	'logoDisplayUrl' | 'screenshotDisplayUrl' | 'form'
>) {
	return (
		<ProjectPreviewPanel>
			<form.Subscribe
				selector={(state) => state.values}
				children={(values) => (
					<ProjectPreviewCard
						values={values}
						logoUrl={logoDisplayUrl}
						screenshotUrl={screenshotDisplayUrl}
					/>
				)}
			/>
		</ProjectPreviewPanel>
	)
}
