import { useForm } from '@tanstack/react-form-start'
import { createFileRoute } from '@tanstack/react-router'
import { useRef } from 'react'
import type { z } from 'zod'

import { slugify } from '@altstack/shared/lib/slug'
import { adminCreateProjectInputSchema } from '@altstack/shared/schemas/admin-project'

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
import { Textarea } from '@altstack/ui/components/textarea'

const defaultValues: z.input<typeof adminCreateProjectInputSchema> = {
	name: '',
	slug: '',
	repositoryUrl: '',
	tagline: '',
	description: '',
	logo: '',
	websiteUrl: undefined,
	content: undefined,
	categorySlugs: [],
}

export const Route = createFileRoute('/_main/projects/create')({
	component: RouteComponent,
})

function RouteComponent() {
	const form = useForm({
		defaultValues,
		validators: {
			onChange: adminCreateProjectInputSchema,
			onSubmit: adminCreateProjectInputSchema,
		},
	})

	// Once the user edits the slug by hand, auto-fill from name stops.
	const isSlugCustomized = useRef(false)

	return (
		<div className="mx-auto grid w-full grid-cols-2 gap-4 p-4">
			<form
				id="create-project-form"
				onSubmit={(e) => {
					e.preventDefault()
					void form.handleSubmit()
				}}
			>
				<FieldGroup>
					<div className="grid grid-cols-2 gap-4">
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

					<div className="grid grid-cols-2 gap-4">
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
											/>
										</InputGroup>

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

					<form.Field
						name="tagline"
						children={(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid

							return (
								<Field data-invalid={isInvalid}>
									<FieldLabel htmlFor={field.name}>Tagline</FieldLabel>

									<Input
										id={field.name}
										name={field.name}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										aria-invalid={isInvalid}
										placeholder="Tagline"
									/>

									{isInvalid && <FieldError errors={field.state.meta.errors} />}
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
									<FieldLabel htmlFor={field.name}>Description</FieldLabel>

									<Textarea
										id={field.name}
										name={field.name}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										aria-invalid={isInvalid}
										placeholder="Short description"
									/>

									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							)
						}}
					/>

					<form.Field
						name="content"
						children={(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid

							return (
								<Field data-invalid={isInvalid}>
									<FieldLabel htmlFor={field.name}>Content</FieldLabel>

									<Textarea
										id={field.name}
										name={field.name}
										value={field.state.value ?? ''}
										onBlur={field.handleBlur}
										onChange={(e) => {
											const next = e.target.value
											field.handleChange(next === '' ? undefined : next)
										}}
										aria-invalid={isInvalid}
										placeholder="Content"
									/>

									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							)
						}}
					/>

					<form.Field
						name="logo"
						children={(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid

							return (
								<Field data-invalid={isInvalid}>
									<FieldLabel htmlFor={field.name}>Logo</FieldLabel>

									<Input
										id={field.name}
										name={field.name}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										aria-invalid={isInvalid}
										placeholder="Logo"
									/>

									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							)
						}}
					/>
				</FieldGroup>
			</form>

			<div>Hello "/_main/projects/create"!</div>
		</div>
	)
}
