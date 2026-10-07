import { useForm } from '@tanstack/react-form-start'
import { ClientOnly, Link } from '@tanstack/react-router'
import { useRef, useState } from 'react'

import { slugify } from '@altstack/shared/lib/slug'

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
	NativeSelect,
	NativeSelectOption,
} from '@altstack/ui/components/native-select'
import { Textarea } from '@altstack/ui/components/textarea'

import {
	categoryFormSchema,
	categoryLabel,
	categoryPathChanges,
	categoryPreviewPath,
	categoryUpdatePayload,
	eligibleParents,
} from '#/features/admin-categories/model'
import type {
	AdminCategory,
	CategoryFormValues,
} from '#/features/admin-categories/model'

interface CategoryFormProps {
	category?: AdminCategory
	categories: Array<AdminCategory>
	pending: boolean
	onSubmit: (
		values: CategoryFormValues,
		original?: AdminCategory
	) => Promise<void>
}

export function CategoryForm({
	category,
	categories,
	pending,
	onSubmit,
}: CategoryFormProps) {
	// Keep the original record and defaults stable across cache refreshes. Only a
	// successful submission/navigation replaces the editor, never a failed write.
	const [original] = useState(category)
	const [error, setError] = useState<string | null>(null)
	const customizedSlug = useRef(!!original)
	const [defaultValues] = useState<CategoryFormValues>(() => {
		return {
			name: original?.name ?? '',
			slug: original?.slug ?? '',
			description: original?.description ?? '',
			parentId: original?.parentId ?? null,
		}
	})
	const schema = categoryFormSchema(original)
	const form = useForm({
		defaultValues,
		validators: { onChange: schema, onSubmit: schema },
		onSubmit: async ({ value }) => {
			setError(null)
			if (
				original &&
				Object.keys(categoryUpdatePayload(original, value)).length === 1
			) {
				setError('No category changes to save.')
				return
			}
			try {
				await onSubmit(value, original)
			} catch (cause) {
				setError(
					cause instanceof Error
						? cause.message
						: 'Unable to save category. Please retry.'
				)
			}
		},
	})
	const parents = eligibleParents(categories, original)
	if (
		original?.parentId &&
		!parents.some((parent) => parent.id === original.parentId)
	) {
		// A stale detail may refer to a parent absent from the refreshed list.
		// Preserve it rather than silently moving the category to root.
		const parent = categories.find((node) => node.id === original.parentId)
		if (parent) parents.push(parent)
	}

	return (
		<div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6">
			<div className="space-y-3">
				<Link
					to="/admin/categories"
					className="text-sm text-muted-foreground underline"
				>
					Back to categories
				</Link>
				<h1 className="text-xl font-semibold">
					{original ? 'Edit category' : 'Create category'}
				</h1>
				<p className="text-sm text-muted-foreground">
					Organize the catalogue into up to three levels. Projects belong to
					leaf categories.
				</p>
			</div>
			<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
				<form
					className="min-w-0 space-y-5"
					onSubmit={(event) => {
						event.preventDefault()
						void form.handleSubmit()
					}}
				>
					<fieldset disabled={pending} className="min-w-0 space-y-5">
						{(['name', 'slug', 'description'] as const).map((name) => (
							<form.Field
								key={name}
								name={name}
								listeners={{
									onChange: ({ value }) => {
										if (name === 'name' && !customizedSlug.current) {
											form.setFieldValue('slug', slugify(value), {
												dontUpdateMeta: true,
											})
										}
									},
								}}
								children={(field) => {
									const invalid =
										field.state.meta.isTouched && !field.state.meta.isValid
									const inputProps = {
										id: `category-${name}`,
										name,
										value: field.state.value,
										onBlur: field.handleBlur,
										'aria-invalid': invalid,
										'aria-describedby': `category-${name}-help`,
										onChange: (
											event: React.ChangeEvent<
												HTMLInputElement | HTMLTextAreaElement
											>
										) => {
											if (name === 'slug') customizedSlug.current = true
											field.handleChange(event.target.value)
										},
									}
									return (
										<Field data-invalid={invalid}>
											<FieldLabel htmlFor={inputProps.id}>
												{name === 'name'
													? 'Name'
													: name === 'slug'
														? 'Slug'
														: 'Description'}
											</FieldLabel>
											{name === 'description' ? (
												<Textarea {...inputProps} rows={4} />
											) : (
												<Input
													{...inputProps}
													className={name === 'slug' ? 'font-mono' : undefined}
												/>
											)}
											<FieldDescription id={`category-${name}-help`}>
												{name === 'name'
													? '2–100 characters.'
													: name === 'slug'
														? original
															? 'Changing the name keeps this slug. Edit it explicitly to change the URL.'
															: 'Suggested from the name until you edit the slug. Slugs must be globally unique.'
														: original?.description === null
															? 'This legacy description can stay empty. A new description must contain 1–300 characters.'
															: 'Write an original description, 1–300 characters.'}
											</FieldDescription>
											{invalid && (
												<FieldError errors={field.state.meta.errors} />
											)}
										</Field>
									)
								}}
							/>
						))}
						<form.Field
							name="parentId"
							children={(field) => {
								const invalid =
									field.state.meta.isTouched && !field.state.meta.isValid
								return (
									<Field data-invalid={invalid}>
										<FieldLabel htmlFor="category-parent">Parent</FieldLabel>
										<NativeSelect
											id="category-parent"
											className="w-full"
											value={field.state.value ?? ''}
											onBlur={field.handleBlur}
											onChange={(event) =>
												field.handleChange(event.target.value || null)
											}
											aria-invalid={invalid}
											aria-describedby="category-parent-help"
										>
											<NativeSelectOption value="">
												Root (no parent)
											</NativeSelectOption>
											{parents.map((parent) => (
												<NativeSelectOption key={parent.id} value={parent.id}>
													{categoryLabel(parent, categories)}
												</NativeSelectOption>
											))}
											{original?.parentId &&
												!parents.some(
													(parent) => parent.id === original.parentId
												) && (
													<NativeSelectOption value={original.parentId}>
														Current parent (refresh required)
													</NativeSelectOption>
												)}
										</NativeSelect>
										<FieldDescription id="category-parent-help">
											Only parents without direct project assignments and with
											room for the entire subtree are available. The server
											rechecks on save.
										</FieldDescription>
										{invalid && <FieldError errors={field.state.meta.errors} />}
									</Field>
								)
							}}
						/>
					</fieldset>
					{error && (
						<p
							role="alert"
							className="rounded-md border border-destructive/30 p-3 text-sm text-destructive"
						>
							{error} Your edits are preserved. Review the fields and retry.
						</p>
					)}
					<ClientOnly fallback={<Button disabled>Save category</Button>}>
						<form.Subscribe
							selector={(state) => [
								state.canSubmit,
								state.isPristine,
								state.isSubmitting,
							]}
							children={([canSubmit, pristine, submitting]) => (
								<Button
									type="submit"
									disabled={pending || submitting || !canSubmit || pristine}
								>
									{pending || submitting
										? 'Saving…'
										: original
											? 'Save changes'
											: 'Create category'}
								</Button>
							)}
						/>
					</ClientOnly>
				</form>
				<form.Subscribe
					selector={(state) => state.values}
					children={(values) => {
						const path = categoryPreviewPath(values, categories)
						const changes = original
							? categoryPathChanges(original, path, categories)
							: []
						return (
							<Card className="min-w-0 lg:sticky lg:top-16">
								<CardContent className="space-y-4">
									<h2 className="text-sm font-semibold">URL preview</h2>
									<p className="text-xs text-muted-foreground">
										Relative to the site’s origin
									</p>
									<p className="font-mono text-sm wrap-anywhere">
										/categories/{path}
									</p>
									{changes.length > 0 && (
										<div className="space-y-3 text-sm">
											<p>
												This category’s URL
												{changes.length > 1
													? ` and ${changes.length - 1} descendant URL(s)`
													: ''}{' '}
												will change. Old links will redirect to the new URL.
											</p>
											<ul className="max-h-72 space-y-3 overflow-y-auto">
												{changes.map((change) => (
													<li key={change.id} className="space-y-1">
														<p className="font-medium">{change.name}</p>
														<p className="font-mono text-xs wrap-anywhere">
															{change.previous} → {change.next}
														</p>
													</li>
												))}
											</ul>
										</div>
									)}
								</CardContent>
							</Card>
						)
					}}
				/>
			</div>
		</div>
	)
}
