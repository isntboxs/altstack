import { IconArrowLeft, IconBrandGithub, IconPhoto } from '@tabler/icons-react'
import { useForm } from '@tanstack/react-form-start'
import { ClientOnly, createFileRoute, Link } from '@tanstack/react-router'
import { Suspense, useRef, useState } from 'react'
import type { z } from 'zod'

import type { ORPCRouterOutputs } from '@altstack/api/routers'

import { slugify } from '@altstack/shared/lib/slug'
import { adminUpdateProjectBodySchema } from '@altstack/shared/schemas/admin-project'

import { Button } from '@altstack/ui/components/button'
import { Card, CardContent } from '@altstack/ui/components/card'
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from '@altstack/ui/components/field'
import { Input } from '@altstack/ui/components/input'
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	InputGroupText,
} from '@altstack/ui/components/input-group'
import { Skeleton } from '@altstack/ui/components/skeleton'
import { Textarea } from '@altstack/ui/components/textarea'
import { toast } from '@altstack/ui/components/toast'

import type { BlockNoteEditorHandle } from '#/components/block-note/editor'
import BlockNoteEditor from '#/components/block-note/editor'
import { CategoryCombobox } from '#/components/category-combobox'
import { LogoUploader, ScreenshotUploader } from '#/components/image-uploader'
import { ProjectCategoryBadges } from '#/components/project-category-badges'
import { GithubMetadataPrefill } from '#/features/admin-projects/components/github-metadata-prefill'
import { GithubReadmeImport } from '#/features/admin-projects/components/github-readme-import'
import { GithubStatisticsRefresh } from '#/features/admin-projects/components/github-statistics-refresh'
import { ProjectReviewActions } from '#/features/admin-projects/components/project-review-actions'
import { ProjectReviewHistory } from '#/features/admin-projects/components/project-review-history'
import {
	adminProjectQueries,
	useAdminProjectGet,
	useAdminProjectUpdate,
} from '#/features/admin-projects/queries'
import { resolveFileUrl } from '#/utils/storage'

// Same form as create, minus the id. Every field is optional: omitted image
// fields keep the current image, `screenshot: null` removes it.
const editProjectFormSchema = adminUpdateProjectBodySchema

// Mirrors the max() in the schema; display-only counters.
const TAGLINE_MAX_LENGTH = 100
const DESCRIPTION_MAX_LENGTH = 300

type EditProjectValues = z.input<typeof editProjectFormSchema>
type AdminProject = ORPCRouterOutputs['admin']['project']['getById']

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

// getById returns the canonical repository URL
// (https://github.com/owner/repo) while the form input sits behind a
// https://github.com/ prefix, so prefill the short owner/repo form.
function toRepositoryShortForm(canonicalUrl: string): string {
	return canonicalUrl.replace(/^https?:\/\/(www\.)?github\.com\//i, '')
}

export const Route = createFileRoute('/_main/projects/$id/edit')({
	loader: async ({ context, params }) => {
		await context.queryClient.query(adminProjectQueries.get({ id: params.id }))
	},
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
	values: EditProjectValues
	logoUrl: string | null
	screenshotUrl: string | null
}) {
	const name = (values.name ?? '').trim() || 'Untitled project'
	const slug = (values.slug ?? '').trim() || 'your-slug'
	const tagline = (values.tagline ?? '').trim()
	const description = (values.description ?? '').trim()
	const repository = (values.repositoryUrl ?? '').trim()

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
					<ProjectCategoryBadges slugs={values.categorySlugs ?? []} />
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
	const params = Route.useParams()
	const { data: project } = useAdminProjectGet({ id: params.id })

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
					<h1 className="text-xl font-semibold tracking-tight">Edit project</h1>
					<p className="text-sm text-muted-foreground">
						Edit project details. The preview updates as you type.
					</p>
				</div>
			</div>

			<EditProjectForm key={project.id} project={project} />
			<ProjectReviewHistory
				key={`history-${project.id}`}
				projectId={project.id}
			/>
		</div>
	)
}

export function EditProjectForm({ project }: { project: AdminProject }) {
	const updateProject = useAdminProjectUpdate()
	const [submitError, setSubmitError] = useState<string | null>(null)
	// Form image fields hold tmp keys only (undefined = keep,
	// screenshot null = remove). The existing file keys are resolved to
	// display URLs here so the preview keeps showing them until replaced.
	const [logoDisplayUrl, setLogoDisplayUrl] = useState<string | null>(
		resolveFileUrl(project.logo)
	)
	const [screenshotDisplayUrl, setScreenshotDisplayUrl] = useState<
		string | null
	>(resolveFileUrl(project.screenshot))

	// Refetching saved GitHub stats must never replace in-progress form values.
	const [defaultValues] = useState<EditProjectValues>(() => {
		return {
			name: project.name,
			slug: project.slug,
			repositoryUrl: toRepositoryShortForm(project.repositoryUrl),
			tagline: project.tagline ?? '',
			description: project.description ?? '',
			logo: undefined,
			screenshot: undefined,
			websiteUrl: project.websiteUrl ?? undefined,
			content: project.content ?? undefined,
			categorySlugs: project.categories,
			status: project.status,
			rejectionReason: project.rejectionReason ?? '',
		}
	})

	const form = useForm({
		defaultValues,
		validators: {
			onChange: editProjectFormSchema,
			onSubmit: editProjectFormSchema,
		},
		onSubmit: async ({ value }) => {
			setSubmitError(null)
			try {
				const updated = await updateProject.mutateAsync({
					params: { id: project.id },
					body: {
						...value,
						rejectionReason:
							value.status === 'rejected' ? value.rejectionReason : null,
					},
				})
				form.reset({
					name: updated.name,
					slug: updated.slug,
					repositoryUrl: toRepositoryShortForm(updated.repositoryUrl),
					tagline: updated.tagline ?? '',
					description: updated.description ?? '',
					logo: undefined,
					screenshot: undefined,
					websiteUrl: updated.websiteUrl ?? undefined,
					content: updated.content ?? undefined,
					categorySlugs: updated.categories,
					status: updated.status,
					rejectionReason: updated.rejectionReason ?? '',
				})
				setLogoDisplayUrl(resolveFileUrl(updated.logo))
				setScreenshotDisplayUrl(resolveFileUrl(updated.screenshot))
			} catch (error) {
				setSubmitError(
					error instanceof Error ? error.message : 'Unable to save project.'
				)
				if (
					isUploadExpiredError(error) ||
					isPromotionConflictError(error) ||
					isUploadConsumedError(error)
				) {
					// Same as create: promote deletes tmp keys before the DB
					// update, so a failed submit leaves dead keys — revert to
					// keep and restore the current images so retry starts
					// from re-upload instead of failing again.
					form.setFieldValue('logo', undefined)
					form.setFieldValue('screenshot', undefined)
					setLogoDisplayUrl(resolveFileUrl(project.logo))
					setScreenshotDisplayUrl(resolveFileUrl(project.screenshot))
					toast.add({
						type: 'warning',
						title: 'Images need re-upload',
						description:
							'The uploaded images expired when the submit failed. Please upload them again and retry.',
					})
				}
				return
			}
		},
	})

	// The slug is prefilled from the saved project, so auto-fill from name
	// stays off unless the user edits the slug by hand (same listener as
	// create, opposite starting flag).
	const isSlugCustomized = useRef(true)

	// Flushes the editor's deferred markdown export so handleSubmit below
	// reads the latest content even when submit lands in the same task as
	// the last keystroke.
	const editorRef = useRef<BlockNoteEditorHandle | null>(null)

	return (
		<div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
			<form
				id="edit-project-form"
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
											form.setFieldValue('slug', slugify(value ?? ''), {
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
												value={field.state.value ?? ''}
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
												value={field.state.value ?? ''}
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
													value={field.state.value ?? ''}
													onBlur={field.handleBlur}
													onChange={(e) => field.handleChange(e.target.value)}
													aria-invalid={isInvalid}
													placeholder="owner/repository"
													className="font-mono"
												/>
											</InputGroup>

											<form.Subscribe
												selector={(state) =>
													[
														state.values.repositoryUrl,
														state.isSubmitting,
													] as const
												}
											>
												{([repositoryUrl, isSubmitting]) => (
													<GithubMetadataPrefill
														repositoryUrl={repositoryUrl ?? ''}
														disabled={isSubmitting || updateProject.isPending}
														getCurrentValues={() => {
															return {
																repositoryUrl:
																	form.getFieldValue('repositoryUrl'),
																description: form.getFieldValue('description'),
																websiteUrl: form.getFieldValue('websiteUrl'),
															}
														}}
														onApply={(values) => {
															if ('description' in values) {
																form.setFieldValue(
																	'description',
																	values.description
																)
																void form.validateField('description', 'change')
															}
															if ('websiteUrl' in values) {
																form.setFieldValue(
																	'websiteUrl',
																	values.websiteUrl
																)
																void form.validateField('websiteUrl', 'change')
															}
														}}
													/>
												)}
											</form.Subscribe>

											<form.Subscribe selector={(state) => state.isSubmitting}>
												{(isSubmitting) => (
													<GithubStatisticsRefresh
														projectId={project.id}
														repositoryUrl={project.repositoryUrl}
														disabled={isSubmitting || updateProject.isPending}
													/>
												)}
											</form.Subscribe>

											<FieldDescription>
												Must be a public, actively maintained repository with at
												least 10 stars.
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
											<FieldLabel htmlFor={field.name}>Website URL</FieldLabel>
											<Input
												id={field.name}
												name={field.name}
												value={field.state.value ?? ''}
												onBlur={field.handleBlur}
												onChange={(e) => {
													const next = e.target.value
													field.handleChange(next === '' ? null : next)
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
												{(field.state.value ?? '').length}/{TAGLINE_MAX_LENGTH}
											</span>
										</div>

										<Input
											id={field.name}
											name={field.name}
											value={field.state.value ?? ''}
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
											<FieldLabel htmlFor={field.name}>Description</FieldLabel>
											<span className="shrink-0 text-xs text-muted-foreground tabular-nums">
												{(field.state.value ?? '').length}/
												{DESCRIPTION_MAX_LENGTH}
											</span>
										</div>

										<Textarea
											id={field.name}
											name={field.name}
											value={field.state.value ?? ''}
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

						<form.Subscribe
							selector={(state) =>
								[state.values.repositoryUrl, state.isSubmitting] as const
							}
						>
							{([repositoryUrl, isSubmitting]) => (
								<ClientOnly>
									<GithubReadmeImport
										repositoryUrl={repositoryUrl ?? ''}
										disabled={isSubmitting || updateProject.isPending}
										getRepositoryUrl={() =>
											form.getFieldValue('repositoryUrl') ?? ''
										}
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
												value={field.state.value ?? undefined}
												onBlur={field.handleBlur}
												onChange={(next) =>
													field.handleChange(next.trim() === '' ? null : next)
												}
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
							description="Logo is required to publish. Screenshots are cropped to 16:9."
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

											{!field.state.value && logoDisplayUrl ? (
												<img
													src={logoDisplayUrl}
													alt="Current logo"
													className="aspect-square w-28 rounded-md border object-cover"
												/>
											) : null}

											<LogoUploader
												value={field.state.value ?? ''}
												onChange={(next) => {
													if (next === '') {
														// New upload removed — revert to keeping the
														// current logo.
														field.handleChange(undefined)
														setLogoDisplayUrl(resolveFileUrl(project.logo))
														return
													}
													field.handleChange(next)
												}}
												onDisplayUrlChange={(url) => {
													// The uploader reports null when a new upload is
													// removed — restore the current logo instead of
													// blanking the preview.
													setLogoDisplayUrl(url ?? resolveFileUrl(project.logo))
												}}
											/>

											<FieldDescription>
												Current logo is kept unless you upload a new one.
											</FieldDescription>

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

											{field.state.value === undefined &&
											screenshotDisplayUrl ? (
												<div className="space-y-2">
													<img
														src={screenshotDisplayUrl}
														alt="Current screenshot"
														className="aspect-video w-full rounded-md border object-cover"
													/>
													<Button
														type="button"
														variant="outline"
														size="sm"
														onClick={() => {
															field.handleChange(null)
															setScreenshotDisplayUrl(null)
														}}
													>
														Remove current screenshot
													</Button>
												</div>
											) : null}

											{field.state.value === null ? (
												<p className="text-sm text-muted-foreground">
													Screenshot will be removed on save. Upload a new one
													below to replace it instead.
												</p>
											) : null}

											<ScreenshotUploader
												value={field.state.value ?? ''}
												onChange={(next) => {
													if (next === '') {
														// New upload removed — revert to keeping the
														// current screenshot.
														field.handleChange(undefined)
														setScreenshotDisplayUrl(
															resolveFileUrl(project.screenshot)
														)
														return
													}
													field.handleChange(next)
												}}
												onDisplayUrlChange={(url) => {
													// Null here means a new upload was removed —
													// restore the current screenshot.
													setScreenshotDisplayUrl(
														url ?? resolveFileUrl(project.screenshot)
													)
												}}
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
												value={field.state.value ?? []}
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

						<p className="text-sm">
							Current status: <strong>{project.status}</strong>
						</p>
						{project.submitter && (
							<p className="text-sm text-muted-foreground">
								Submitted by {project.submitter.name} ({project.submitter.email}
								)
							</p>
						)}
						<form.Field
							name="rejectionReason"
							children={(field) => (
								<Field>
									<FieldLabel htmlFor="rejectionReason">
										Rejection reason (optional)
									</FieldLabel>
									<Textarea
										id="rejectionReason"
										value={field.state.value ?? ''}
										maxLength={1000}
										onBlur={field.handleBlur}
										onChange={(event) => field.handleChange(event.target.value)}
									/>
									<FieldDescription>
										Recorded when you reject this project. Restore rejected
										projects to draft to reopen review.
									</FieldDescription>
								</Field>
							)}
						/>
					</section>

					{submitError && (
						<p role="alert" className="text-sm text-destructive">
							{submitError} Your project fields and category selections are
							preserved. If a category changed, review its leaf status and
							retry.
						</p>
					)}
					<ClientOnly fallback={<Button disabled>Save Draft</Button>}>
						<form.Subscribe
							selector={(state) => [state.canSubmit, state.isSubmitting]}
							children={([canSubmit, isSubmitting]) => (
								<ProjectReviewActions
									status={project.status}
									disabled={!canSubmit}
									pending={isSubmitting}
									onAction={(status) => {
										form.setFieldValue('status', status)
										editorRef.current?.flush()
										void form.handleSubmit()
									}}
								/>
							)}
						/>
					</ClientOnly>
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
	)
}
