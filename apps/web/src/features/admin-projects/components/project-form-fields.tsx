import { Suspense } from 'react'
import type { ChangeEvent, ComponentProps, ReactNode } from 'react'

import { Field, FieldError, FieldLabel } from '@altstack/ui/components/field'
import { Input } from '@altstack/ui/components/input'
import { Textarea } from '@altstack/ui/components/textarea'

import { CategoryCombobox } from '#/components/category-combobox'
import { CategoryComboboxSkeleton } from '#/components/workspace-skeletons'
import { SectionHeading } from '#/features/admin-projects/components/project-form-preview'

type ValidationProps = {
	invalid: boolean
	errors: ComponentProps<typeof FieldError>['errors']
}

export function ProjectDescriptionSection({
	children,
}: {
	children: ReactNode
}) {
	return (
		<section className="space-y-4">
			<SectionHeading
				title="Description"
				description="Short copy shown in the catalogue listing."
			/>
			{children}
		</section>
	)
}

export function ProjectCopyField({
	name,
	value,
	onBlur,
	onChange,
	invalid,
	errors,
}: ValidationProps & {
	name: 'tagline' | 'description'
	value: string | null | undefined
	onBlur: () => void
	onChange: (value: string) => void
}) {
	const tagline = name === 'tagline'
	const inputProps = {
		id: name,
		name,
		value: value ?? '',
		onBlur,
		onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
			onChange(event.target.value),
		'aria-invalid': invalid,
		placeholder: tagline ? 'Tagline' : 'Short description',
	}
	return (
		<Field data-invalid={invalid}>
			<div className="flex items-baseline justify-between gap-2">
				<FieldLabel htmlFor={name}>
					{tagline ? 'Tagline' : 'Description'}
				</FieldLabel>
				<span className="shrink-0 text-xs text-muted-foreground tabular-nums">
					{(value ?? '').length}/{tagline ? 100 : 300}
				</span>
			</div>
			{tagline ? <Input {...inputProps} /> : <Textarea {...inputProps} />}
			{invalid && <FieldError errors={errors} />}
		</Field>
	)
}

export function ProjectCategoriesSection({
	id,
	value,
	onValueChange,
	invalid,
	errors,
}: ValidationProps & {
	id: string
	value: Array<string>
	onValueChange: (value: Array<string>) => void
}) {
	return (
		<section className="space-y-4">
			<SectionHeading title="Categories" />
			<Field data-invalid={invalid}>
				<FieldLabel htmlFor={id}>Categories</FieldLabel>
				<Suspense fallback={<CategoryComboboxSkeleton />}>
					<CategoryCombobox
						id={id}
						value={value}
						onValueChange={onValueChange}
					/>
				</Suspense>
				{invalid && <FieldError errors={errors} />}
			</Field>
		</section>
	)
}
