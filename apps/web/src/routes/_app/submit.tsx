import {
	IconActivity,
	IconFileText,
	IconGitFork,
	IconHome,
} from '@tabler/icons-react'
import { useForm } from '@tanstack/react-form-start'
import { createFileRoute, Link } from '@tanstack/react-router'
import { z } from 'zod'

import { env } from '@altstack/env/web'

import { createSubmissionInputSchema } from '@altstack/shared'

import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from '@altstack/ui/components/breadcrumb'
import { Button } from '@altstack/ui/components/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@altstack/ui/components/card'
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldSet,
} from '@altstack/ui/components/field'
import { Input } from '@altstack/ui/components/input'
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	InputGroupText,
} from '@altstack/ui/components/input-group'

import { useCreateSubmission } from '#/features/submissions/queries'

export const Route = createFileRoute('/_app/submit')({
	component: RouteComponent,
})

function RouteComponent() {
	return (
		<div className="container mx-auto w-full max-w-6xl px-6 pt-37 pb-10 lg:px-16">
			<Breadcrumb>
				<BreadcrumbList>
					<BreadcrumbItem>
						<BreadcrumbLink render={<Link to="/" viewTransition />}>
							<IconHome className="size-4" />
						</BreadcrumbLink>
					</BreadcrumbItem>

					<BreadcrumbSeparator className="text-muted-foreground" />

					<BreadcrumbItem>
						<BreadcrumbPage className="text-sm">Submit</BreadcrumbPage>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>

			<div className="mt-4 space-y-2">
				<h1 className="text-3xl font-medium">
					Submit your Open Source Project
				</h1>

				<div className="space-y-1">
					<p className="text-base text-muted-foreground">
						Contribute to {env.VITE_APP_NAME} by submitting a new open source
						project.
					</p>

					<p className="text-base text-muted-foreground">
						You can submit your project by filling out the form below.
					</p>
				</div>
			</div>

			<div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
				<SubmissionForm />

				<SubmissionGuidelines />
			</div>
		</div>
	)
}

const submissionFormSchema = createSubmissionInputSchema
	.omit({ websiteUrl: true })
	.extend({
		websiteUrl: z.string(),
	})

const SubmissionForm = () => {
	const createSubmission = useCreateSubmission()

	const form = useForm({
		defaultValues: {
			name: '',
			repositoryUrl: '',
			websiteUrl: '',
		},
		validators: {
			onChange: z.compile(submissionFormSchema),
			onSubmit: z.compile(submissionFormSchema),
		},
		onSubmit: async ({ formApi, value }) => {
			await createSubmission.mutateAsync(value)

			formApi.reset()
		},
	})

	return (
		<FieldSet className="h-full">
			<form
				id="project-submission-form"
				onSubmit={(e) => {
					e.preventDefault()
					void form.handleSubmit()
				}}
			>
				<FieldGroup className="h-full">
					<div className="flex flex-col gap-5">
						<div className="grid grid-cols-2 gap-4">
							<form.Field
								name="name"
								children={(field) => {
									const isInvalid =
										field.state.meta.isTouched && !field.state.meta.isValid

									return (
										<Field data-invalid={isInvalid}>
											<FieldLabel htmlFor={field.name}>Project Name</FieldLabel>
											<Input
												id={field.name}
												name={field.name}
												value={field.state.value}
												onBlur={field.handleBlur}
												onChange={(e) => field.handleChange(e.target.value)}
												aria-invalid={isInvalid}
												placeholder="Project Name"
												className="h-10"
											/>

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
												value={field.state.value}
												onBlur={field.handleBlur}
												onChange={(e) => field.handleChange(e.target.value)}
												aria-invalid={isInvalid}
												placeholder="Website URL"
												className="h-10"
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
							name="repositoryUrl"
							children={(field) => {
								const isInvalid =
									field.state.meta.isTouched && !field.state.meta.isValid

								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={field.name}>Repository URL</FieldLabel>
										<InputGroup className="h-10">
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
					</div>

					<Field orientation="horizontal" className="mt-auto pt-4">
						<Button type="submit" className="h-10">
							Submit your Project
						</Button>
					</Field>
				</FieldGroup>
			</form>
		</FieldSet>
	)
}

const listGuideLines = [
	{
		icon: IconGitFork,
		title: 'Public Repository',
		description: 'Currently only support GitHub hosted repositories.',
	},
	{
		icon: IconActivity,
		title: 'Actively Maintained',
		description:
			'The repository should be active with regular updates and at least 10 stars.',
	},
	{
		icon: IconFileText,
		title: 'Clear Documentation',
		description:
			'Must have a descriptive README covering features and installation instructions.',
	},
]

const SubmissionGuidelines = () => (
	<div className="rounded-xl p-1 ring-1 ring-foreground/10">
		<Card size="sm" className="size-full ring-0">
			<CardHeader>
				<CardTitle>Submission Guidelines</CardTitle>

				<CardDescription className="text-xs">
					We review all submissions to ensure high quality.
				</CardDescription>
			</CardHeader>

			<CardContent>
				<ul className="space-y-4">
					{listGuideLines.map((guideLine, idx) => (
						<li key={idx} className="flex items-start gap-2">
							<guideLine.icon className="mt-0.5 size-4 shrink-0" />

							<div className="space-y-0.5">
								<p className="text-sm font-medium">{guideLine.title}</p>

								<p className="text-xs text-muted-foreground">
									{guideLine.description}
								</p>
							</div>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	</div>
)
