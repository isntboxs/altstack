import { useForm } from '@tanstack/react-form-start'
import { useState } from 'react'
import type { z } from 'zod'

import { createSubmissionInputSchema } from '@altstack/shared/schemas/submission'

import { Button } from '@altstack/ui/components/button'
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from '@altstack/ui/components/field'
import { Input } from '@altstack/ui/components/input'
import { Spinner } from '@altstack/ui/components/spinner'

const fields = [
	{
		name: 'name',
		label: 'Project name',
		placeholder: 'Your project',
		required: true,
	},
	{
		name: 'websiteUrl',
		label: 'Website URL (optional)',
		placeholder: 'https://example.com',
		required: false,
	},
	{
		name: 'repositoryUrl',
		label: 'GitHub repository',
		placeholder: 'owner/repository or https://github.com/owner/repository',
		required: true,
	},
] as const

export function SubmissionForm({
	onSubmit,
}: {
	onSubmit: (
		input: z.output<typeof createSubmissionInputSchema>
	) => Promise<unknown>
}) {
	const [error, setError] = useState<string | null>(null)
	const [success, setSuccess] = useState(false)
	const defaultValues: z.input<typeof createSubmissionInputSchema> = {
		name: '',
		websiteUrl: '',
		repositoryUrl: '',
	}
	const form = useForm({
		defaultValues,
		validators: {
			onChange: createSubmissionInputSchema,
			onSubmit: createSubmissionInputSchema,
		},
		onSubmit: async ({ value, formApi }) => {
			setError(null)
			setSuccess(false)
			try {
				await onSubmit(createSubmissionInputSchema.parse(value))
				formApi.reset()
				setSuccess(true)
			} catch (failure) {
				setError(
					failure instanceof Error
						? failure.message
						: 'Unable to submit your project. Please try again.'
				)
			}
		},
	})

	return (
		<form
			noValidate
			onSubmit={(event) => {
				event.preventDefault()
				void form.handleSubmit()
			}}
		>
			<form.Subscribe
				selector={(state) => state.isSubmitting}
				children={(pending) => (
					<fieldset
						disabled={pending}
						aria-busy={pending}
						className="space-y-6"
					>
						<legend className="sr-only">Submit a project</legend>
						<div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
							{fields.map(({ name, label, placeholder, required }) => (
								<form.Field
									key={name}
									name={name}
									children={(field) => {
										const invalid =
											!field.state.meta.isValid &&
											(field.state.meta.isTouched ||
												form.state.submissionAttempts > 0)
										return (
											<Field
												className={
													name === 'repositoryUrl' ? 'sm:col-span-2' : ''
												}
												data-invalid={invalid}
											>
												<FieldLabel htmlFor={`submission-${name}`}>
													{label}
												</FieldLabel>
												<Input
													id={`submission-${name}`}
													name={name}
													value={field.state.value ?? ''}
													onBlur={field.handleBlur}
													onChange={(event) =>
														field.handleChange(event.target.value)
													}
													required={required}
													aria-invalid={invalid}
													aria-describedby={
														invalid ? `submission-${name}-error` : undefined
													}
													placeholder={placeholder}
													className="h-10"
												/>
												{invalid && (
													<FieldError
														id={`submission-${name}-error`}
														errors={field.state.meta.errors}
													/>
												)}
												{name === 'repositoryUrl' && (
													<FieldDescription>
														Enter a public GitHub repository. Our team will
														review it before publishing.
													</FieldDescription>
												)}
											</Field>
										)
									}}
								/>
							))}
						</div>
						{error && (
							<p role="alert" className="text-sm text-destructive">
								{error}
							</p>
						)}
						{success && (
							<output className="block rounded-lg border bg-muted p-4 text-sm">
								Your project has been submitted and is awaiting review.
							</output>
						)}
						<Button
							type="submit"
							disabled={pending}
							className="w-full sm:w-auto"
						>
							{pending ? (
								<>
									<Spinner /> Submitting…
								</>
							) : (
								'Submit project'
							)}
						</Button>
					</fieldset>
				)}
			/>
		</form>
	)
}
