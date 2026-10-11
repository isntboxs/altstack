import {
	IconActivity,
	IconBrandGithub,
	IconFileText,
	IconStar,
} from '@tabler/icons-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'

import { SubmissionForm } from '#/features/submissions/components/submission-form'
import { orpc } from '#/utils/orpc'

export const Route = createFileRoute('/_app/submit')({
	beforeLoad: ({ context: { auth } }) => {
		if (!auth) {
			throw redirect({
				to: '/auth/sign-in',
				search: { returnTo: '/submit' },
				replace: true,
			})
		}
	},
	component: SubmissionPage,
})

const guidelines = [
	{
		title: 'Public repository',
		description: 'Your project must have a public GitHub repository.',
		icon: IconBrandGithub,
	},
	{
		title: 'Actively maintained',
		description:
			'We look for projects with recent activity and ongoing maintenance.',
		icon: IconActivity,
	},
	{
		title: 'At least 10 stars',
		description: 'Community interest helps us discover useful projects.',
		icon: IconStar,
	},
	{
		title: 'Clear README',
		description:
			'Explain what your project does and how people can get started.',
		icon: IconFileText,
	},
]

function SubmissionPage() {
	const queryClient = useQueryClient()
	const createSubmission = useMutation({
		...orpc.submission.create.mutationOptions(),
		retry: false,
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: orpc.submission.key() }),
	})
	return (
		<div className="container mx-auto w-full max-w-6xl px-4 pt-28 pb-12 sm:px-6 lg:px-16">
			<div className="space-y-3">
				<h1 className="text-3xl font-medium tracking-tight">
					Submit your open source project
				</h1>
				<p className="max-w-2xl text-base text-muted-foreground">
					Help others discover useful open source software. Share your project
					with Altstack and our team will review it for the catalogue.
				</p>
				<Link
					to="/submission"
					className="inline-block text-sm text-primary underline underline-offset-4"
				>
					View your submissions
				</Link>
			</div>
			<div className="mt-10 grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
				<SubmissionForm onSubmit={createSubmission.mutateAsync} />
				<aside
					aria-label="Submission guidelines"
					className="space-y-5 border-t pt-6 lg:border-t-0 lg:pt-0"
				>
					<div className="space-y-1">
						<h2 className="text-sm font-semibold">Submission guidelines</h2>
						<p className="text-sm text-muted-foreground">
							Our team reviews every submission for quality.
						</p>
					</div>
					<ul className="space-y-5">
						{guidelines.map(({ title, description, icon: Icon }) => (
							<li key={title} className="flex gap-3">
								<Icon
									className="mt-0.5 size-4 shrink-0 text-primary"
									aria-hidden="true"
								/>
								<div className="space-y-1">
									<h3 className="text-sm font-medium">{title}</h3>
									<p className="text-sm text-muted-foreground">{description}</p>
								</div>
							</li>
						))}
					</ul>
					<p className="text-xs text-muted-foreground">
						Stars, activity, and README quality are reviewed by our team. They
						do not prevent you from submitting.
					</p>
				</aside>
			</div>
		</div>
	)
}
