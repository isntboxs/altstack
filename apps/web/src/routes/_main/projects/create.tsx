import { IconArrowLeft, IconBrandGithub, IconPhoto } from '@tabler/icons-react'
import { useForm } from '@tanstack/react-form-start'
import { ClientOnly, createFileRoute, Link } from '@tanstack/react-router'
import { Suspense, useRef, useState } from 'react'
import type { z } from 'zod'

import { slugify } from '@altstack/shared/lib/slug'
import { adminCreateProjectBodySchema } from '@altstack/shared/schemas/admin-project'

import { Button } from '@altstack/ui/components/button'
import { Card, CardContent } from '@altstack/ui/components/card'
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
import { Skeleton } from '@altstack/ui/components/skeleton'
import { Spinner } from '@altstack/ui/components/spinner'
import { Textarea } from '@altstack/ui/components/textarea'
import { toast } from '@altstack/ui/components/toast'

import BlockNoteEditor from '#/components/block-note/editor'
import type { BlockNoteEditorHandle } from '#/components/block-note/editor'
import { CategoryCombobox } from '#/components/category-combobox'
import { LogoUploader, ScreenshotUploader } from '#/components/image-uploader'
import { ProjectCategoryBadges } from '#/components/project-category-badges'
import { useAdminProjectCreate } from '#/features/admin-projects/queries'

// Mirrors the max() in adminCreateProjectBodySchema; display-only counters.
const TAGLINE_MAX_LENGTH = 100
const DESCRIPTION_MAX_LENGTH = 300

const defaultValues: z.input<typeof adminCreateProjectBodySchema> = {
	name: '',
	slug: '',
	repositoryUrl: '',
	tagline: '',
	description: '',
	logo: '',
	screenshot: undefined,
	websiteUrl: undefined,
	content: undefined,
	categorySlugs: [],
	// Explicit default: new projects publish immediately unless saved as
	// draft (hidden from the public catalogue). Mirrors the
	// `.default('published')` in adminCreateProjectBodySchema.
	status: 'published',
}

type CreateProjectValues = z.input<typeof adminCreateProjectBodySchema>

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

export const Route = createFileRoute('/_main/projects/create')({
	component: RouteComponent,
})

function SectionHeading({
	title,
	description,
}: {
	title: string
	description?: string
}) {
	return (
		<div className="space-y-1">
			<h2 className="text-sm font-semibold">{title}</h2>
			{description ? (
				<p className="text-sm text-muted-foreground">{description}</p>
			) : null}
		</div>
	)
}

function ProjectPreviewCard({
	values,
	logoUrl,
	screenshotUrl,
}: {
	values: CreateProjectValues
	logoUrl: string | null
	screenshotUrl: string | null
}) {
	const name = values.name.trim() || 'Untitled project'
	const slug = values.slug.trim() || 'your-slug'
	const tagline = values.tagline.trim()
	const description = values.description.trim()
	const repository = values.repositoryUrl.trim()

	return (
		<Card className="overflow-hidden">
			<CardContent className="space-y-4">
				<div className="flex items-center gap-3">
					{logoUrl ? (
						<img
							src={logoUrl}
							alt=""
							className="size-10 shrink-0 rounded-md border object-cover"
						/>
					) : (
						<div
							aria-hidden="true"
							className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-semibold text-muted-foreground"
						>
							{name.charAt(0).toUpperCase()}
						</div>
					)}

					<div className="min-w-0">
						<p className="truncate text-sm font-semibold">{name}</p>
						<p className="truncate font-mono text-xs text-muted-foreground">
							/{slug}
						</p>
					</div>
				</div>

				{screenshotUrl ? (
					<img
						src={screenshotUrl}
						alt=""
						className="aspect-video w-full rounded-md border object-cover"
					/>
				) : (
					<div className="flex aspect-video w-full flex-col items-center justify-center gap-1.5 rounded-md border border-dashed text-muted-foreground">
						<IconPhoto className="size-5" />
						<p className="text-xs">16:9 screenshot preview</p>
					</div>
				)}

				<div className="space-y-1">
					<p className={tagline ? 'text-sm' : 'text-sm text-muted-foreground'}>
						{tagline || 'Tagline will appear here.'}
					</p>
					<p
						className={
							description
								? 'line-clamp-3 text-sm text-muted-foreground'
								: 'text-sm text-muted-foreground/60'
						}
					>
						{description || 'Short description will appear here.'}
					</p>
				</div>

				<div className="flex flex-wrap gap-1.5">
					<ProjectCategoryBadges slugs={values.categorySlugs} />
				</div>

				<div className="flex items-center gap-1.5 border-t pt-3 text-xs text-muted-foreground">
					<IconBrandGithub className="size-3.5 shrink-0" />
					<span className="truncate font-mono">
						{repository
							? `github.com/${repository}`
							: 'github.com/owner/repository'}
					</span>
				</div>
			</CardContent>
		</Card>
	)
}

function RouteComponent() {
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
					formApi.setFieldValue('logo', '')
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

	return (
		<div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6">
			<div className="space-y-3">
				<Link
					to="/projects"
					className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
				>
					<IconArrowLeft className="size-4" />
					Projects
				</Link>

				<div className="space-y-1">
					<h1 className="text-xl font-semibold tracking-tight">
						Create project
					</h1>
					<p className="text-sm text-muted-foreground">
						Add a new project to the catalogue. The preview updates as you type.
					</p>
				</div>
			</div>

			<div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
				<form
					id="create-project-form"
					className="min-w-0"
					onSubmit={(e) => {
						e.preventDefault()
						editorRef.current?.flush()
						void form.handleSubmit()
					}}
				>
					<div className="space-y-8">
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

												{isInvalid && (
													<FieldError errors={field.state.meta.errors} />
												)}
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

												{isInvalid && (
													<FieldError errors={field.state.meta.errors} />
												)}
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
												<FieldLabel htmlFor={field.name}>
													Repository URL
												</FieldLabel>
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

												<FieldDescription>
													Must be a public, actively maintained repository with
													at least 10 stars.
												</FieldDescription>

												{isInvalid && (
													<FieldError errors={field.state.meta.errors} />
												)}
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
												<FieldLabel htmlFor={field.name}>
													Website URL
												</FieldLabel>
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

												{isInvalid && (
													<FieldError errors={field.state.meta.errors} />
												)}
											</Field>
										)
									}}
								/>
							</div>
						</section>

						<section className="space-y-4">
							<SectionHeading
								title="Description"
								description="Short copy shown in the catalogue listing."
							/>

							<form.Field
								name="tagline"
								children={(field) => {
									const isInvalid =
										field.state.meta.isTouched && !field.state.meta.isValid

									return (
										<Field data-invalid={isInvalid}>
											<div className="flex items-baseline justify-between gap-2">
												<FieldLabel htmlFor={field.name}>Tagline</FieldLabel>
												<span className="shrink-0 text-xs text-muted-foreground tabular-nums">
													{field.state.value.length}/{TAGLINE_MAX_LENGTH}
												</span>
											</div>

											<Input
												id={field.name}
												name={field.name}
												value={field.state.value}
												onBlur={field.handleBlur}
												onChange={(e) => field.handleChange(e.target.value)}
												aria-invalid={isInvalid}
												placeholder="Tagline"
											/>

											{isInvalid && (
												<FieldError errors={field.state.meta.errors} />
											)}
										</Field>
									)
								}}
							/>

							<form.Field
								name="description"
								children={(field) => {
									const isInvalid =
										field.state.meta.isTouched && !field.state.meta.isValid

									return (
										<Field data-invalid={isInvalid}>
											<div className="flex items-baseline justify-between gap-2">
												<FieldLabel htmlFor={field.name}>
													Description
												</FieldLabel>
												<span className="shrink-0 text-xs text-muted-foreground tabular-nums">
													{field.state.value.length}/{DESCRIPTION_MAX_LENGTH}
												</span>
											</div>

											<Textarea
												id={field.name}
												name={field.name}
												value={field.state.value}
												onBlur={field.handleBlur}
												onChange={(e) => field.handleChange(e.target.value)}
												aria-invalid={isInvalid}
												placeholder="Short description"
											/>

											{isInvalid && (
												<FieldError errors={field.state.meta.errors} />
											)}
										</Field>
									)
								}}
							/>
						</section>

						<section className="space-y-4">
							<SectionHeading title="Content" />

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
													value={field.state.value}
													onBlur={field.handleBlur}
													onChange={(e) => field.handleChange(e)}
													className="rounded-lg border border-input bg-transparent px-2.5 py-2 transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
												/>
											</ClientOnly>

											{isInvalid && (
												<FieldError errors={field.state.meta.errors} />
											)}
										</Field>
									)
								}}
							/>
						</section>

						<section className="space-y-4">
							<SectionHeading
								title="Media"
								description="Logo is required. Screenshots are cropped to 16:9."
							/>

							<div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
								<form.Field
									name="logo"
									children={(field) => {
										const isInvalid =
											field.state.meta.isTouched && !field.state.meta.isValid

										return (
											<Field data-invalid={isInvalid}>
												<FieldLabel htmlFor={field.name}>Logo</FieldLabel>

												<LogoUploader
													value={field.state.value}
													onChange={(next) => field.handleChange(next)}
													onDisplayUrlChange={setLogoDisplayUrl}
												/>

												{isInvalid && (
													<FieldError errors={field.state.meta.errors} />
												)}
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
													value={field.state.value}
													onChange={(next) =>
														field.handleChange(next === '' ? undefined : next)
													}
													onDisplayUrlChange={setScreenshotDisplayUrl}
												/>

												<FieldDescription>
													Optional landing page capture in 16:9.
												</FieldDescription>

												{isInvalid && (
													<FieldError errors={field.state.meta.errors} />
												)}
											</Field>
										)
									}}
								/>
							</div>
						</section>

						<section className="space-y-4">
							<SectionHeading title="Categories" />

							<form.Field
								name="categorySlugs"
								children={(field) => {
									const isInvalid =
										field.state.meta.isTouched && !field.state.meta.isValid

									return (
										<Field data-invalid={isInvalid}>
											<FieldLabel htmlFor={field.name}>Categories</FieldLabel>
											<Suspense fallback={<Skeleton className="h-10 w-full" />}>
												<CategoryCombobox
													id={field.name}
													value={field.state.value}
													onValueChange={(next) => field.handleChange(next)}
												/>
											</Suspense>

											{isInvalid && (
												<FieldError errors={field.state.meta.errors} />
											)}
										</Field>
									)
								}}
							/>
						</section>

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
													field.handleChange(
														e.target.value as 'draft' | 'published'
													)
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

											{isInvalid && (
												<FieldError errors={field.state.meta.errors} />
											)}
										</Field>
									)
								}}
							/>
						</section>

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

				<aside className="min-w-0 lg:sticky lg:top-16">
					<div className="space-y-3">
						<div className="space-y-1">
							<h2 className="text-sm font-semibold">Preview</h2>
							<p className="text-sm text-muted-foreground">
								How this project will appear in the catalogue.
							</p>
						</div>

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
					</div>
				</aside>
			</div>
		</div>
	)
}
