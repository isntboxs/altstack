import { IconBrandGithub } from '@tabler/icons-react'
import { useEffect, useId, useRef, useState } from 'react'

import { adminCreateProjectBodySchema } from '@altstack/shared/schemas/admin-project'
import { repositoryUrlSchema } from '@altstack/shared/schemas/common'

import { Button } from '@altstack/ui/components/button'
import { Checkbox } from '@altstack/ui/components/checkbox'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@altstack/ui/components/dialog'
import { Input } from '@altstack/ui/components/input'
import { Spinner } from '@altstack/ui/components/spinner'
import { Textarea } from '@altstack/ui/components/textarea'

import { useAdminProjectGithubMetadata } from '#/features/admin-projects/queries'

type MetadataFields = { description?: string | null; websiteUrl?: string }
type CurrentValues = {
	repositoryUrl?: string
	description?: string | null
	websiteUrl?: string | null
}
type Preview = {
	repositoryUrl: string
	requestedRepositoryUrl: string
	description: string
	websiteUrl: string
	hasDescription: boolean
	hasWebsite: boolean
	selectDescription: boolean
	selectWebsite: boolean
}

const REPOSITORY_CHANGED =
	'Repository changed. Fetch from GitHub again to preview its metadata.'
const isBlank = (value: string | null | undefined) => !value?.trim()

export function GithubMetadataPrefill({
	repositoryUrl,
	disabled,
	getCurrentValues,
	onApply,
}: {
	repositoryUrl: string
	disabled: boolean
	getCurrentValues: () => CurrentValues
	onApply: (values: MetadataFields) => void
}) {
	const { mutateAsync } = useAdminProjectGithubMetadata()
	const id = useId()
	const requestId = useRef(0)
	const activeRepository = useRef(repositoryUrl)
	const [pending, setPending] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [feedback, setFeedback] = useState<string | null>(null)
	const [preview, setPreview] = useState<Preview | null>(null)

	useEffect(() => {
		if (activeRepository.current === repositoryUrl) return
		activeRepository.current = repositoryUrl
		if (requestId.current === 0) return
		requestId.current += 1
		// Synchronize an external form field with the request/dialog lifecycle.
		// oxlint-disable-next-line react-hooks-js/set-state-in-effect
		setPending(false)
		setError(null)
		setPreview(null)
		setFeedback(REPOSITORY_CHANGED)
	}, [repositoryUrl])
	useEffect(
		() => () => {
			if (requestId.current > 0) requestId.current += 1
		},
		[]
	)

	async function fetchMetadata() {
		if (
			disabled ||
			pending ||
			!repositoryUrlSchema.safeParse(repositoryUrl).success
		) {
			return
		}
		const requestedRepositoryUrl = repositoryUrl
		const currentRequestId = ++requestId.current
		setPending(true)
		setError(null)
		setFeedback(null)
		setPreview(null)
		try {
			const metadata = await mutateAsync({
				repositoryUrl: requestedRepositoryUrl,
			})
			if (currentRequestId !== requestId.current) return
			const current = getCurrentValues()
			if (current.repositoryUrl !== requestedRepositoryUrl) {
				setFeedback(REPOSITORY_CHANGED)
				return
			}
			setPreview({
				repositoryUrl: metadata.repositoryUrl,
				requestedRepositoryUrl,
				description: metadata.description ?? '',
				websiteUrl: metadata.websiteUrl ?? '',
				hasDescription: metadata.description !== null,
				hasWebsite: metadata.websiteUrl !== null,
				selectDescription:
					metadata.description !== null && isBlank(current.description),
				selectWebsite:
					metadata.websiteUrl !== null && isBlank(current.websiteUrl),
			})
		} catch (cause) {
			if (currentRequestId !== requestId.current) return
			if (getCurrentValues().repositoryUrl !== requestedRepositoryUrl) {
				setFeedback(REPOSITORY_CHANGED)
				return
			}
			setError(
				cause instanceof Error
					? cause.message
					: 'Unable to fetch GitHub metadata. Please try again.'
			)
		} finally {
			if (currentRequestId === requestId.current) setPending(false)
		}
	}

	const description = adminCreateProjectBodySchema.shape.description.safeParse(
		preview?.description
	)
	const website = adminCreateProjectBodySchema.shape.websiteUrl.safeParse(
		preview?.websiteUrl.trim()
	)
	const canApply = Boolean(
		preview &&
		!disabled &&
		(preview.selectDescription || preview.selectWebsite) &&
		(!preview.selectDescription || description.success) &&
		(!preview.selectWebsite || website.success)
	)

	function apply() {
		if (!preview || !canApply) return
		if (getCurrentValues().repositoryUrl !== preview.requestedRepositoryUrl) {
			setPreview(null)
			setFeedback(REPOSITORY_CHANGED)
			return
		}
		const values: MetadataFields = {}
		if (preview.selectDescription && description.success) {
			values.description = description.data ?? null
		}
		if (preview.selectWebsite && website.success) {
			values.websiteUrl = website.data
		}
		onApply(values)
		setPreview(null)
		setFeedback(
			'Selected metadata applied to the form. Save the project to keep these changes.'
		)
	}

	return (
		<div className="min-w-0 space-y-2">
			<Button
				type="button"
				variant="outline"
				size="sm"
				disabled={
					disabled ||
					pending ||
					!repositoryUrlSchema.safeParse(repositoryUrl).success
				}
				onClick={() => void fetchMetadata()}
			>
				{pending ? (
					<Spinner aria-hidden="true" />
				) : (
					<IconBrandGithub aria-hidden="true" />
				)}
				{pending ? 'Fetching from GitHub…' : 'Fetch from GitHub'}
			</Button>
			{pending && (
				<output className="block text-xs text-muted-foreground">
					Fetching repository metadata…
				</output>
			)}
			{error && (
				<p role="alert" className="text-xs text-destructive">
					{error} Use Fetch from GitHub to retry.
				</p>
			)}
			{feedback && (
				<output className="block text-xs text-muted-foreground">
					{feedback}
				</output>
			)}
			<Dialog
				open={preview !== null}
				onOpenChange={(open) => {
					if (!open) setPreview(null)
				}}
			>
				<DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
					<DialogHeader>
						<DialogTitle>Preview GitHub metadata</DialogTitle>
						<DialogDescription>
							Choose the fields to apply. Selecting a populated field replaces
							its current value. Changes are saved only when you save the
							project.
						</DialogDescription>
					</DialogHeader>
					{preview && (
						<>
							<div className="min-w-0 space-y-1">
								<p className="text-xs text-muted-foreground">
									Source repository
								</p>
								<a
									href={preview.repositoryUrl}
									target="_blank"
									rel="noreferrer"
									className="text-sm break-all underline underline-offset-4"
								>
									{preview.repositoryUrl}
								</a>
							</div>
							<div className="min-w-0 space-y-2">
								<label
									className="flex items-center gap-2"
									htmlFor={`${id}-description-selected`}
								>
									<Checkbox
										id={`${id}-description-selected`}
										checked={preview.selectDescription}
										onCheckedChange={(checked) =>
											setPreview({ ...preview, selectDescription: checked })
										}
									/>
									Apply description
								</label>
								{!preview.hasDescription && (
									<p className="text-xs text-muted-foreground">
										GitHub has no description suggestion.
									</p>
								)}
								<label className="sr-only" htmlFor={`${id}-description`}>
									Description suggestion
								</label>
								<Textarea
									id={`${id}-description`}
									className="max-h-40 overflow-y-auto"
									value={preview.description}
									onChange={(event) =>
										setPreview({ ...preview, description: event.target.value })
									}
									aria-invalid={!description.success}
									aria-describedby={`${id}-description-help`}
									rows={4}
								/>
								<div
									id={`${id}-description-help`}
									className="space-y-1 text-xs"
								>
									<p className="text-muted-foreground">
										{preview.description.trim().length}/300 characters
									</p>
									{!description.success && (
										<p className="text-destructive">
											Description must be 300 characters or fewer. Edit the
											suggestion before applying it.
										</p>
									)}
								</div>
							</div>
							<div className="min-w-0 space-y-2">
								<label
									className="flex items-center gap-2"
									htmlFor={`${id}-website-selected`}
								>
									<Checkbox
										id={`${id}-website-selected`}
										checked={preview.selectWebsite}
										onCheckedChange={(checked) =>
											setPreview({ ...preview, selectWebsite: checked })
										}
									/>
									Apply website
								</label>
								{!preview.hasWebsite && (
									<p className="text-xs text-muted-foreground">
										GitHub has no valid HTTP(S) website suggestion.
									</p>
								)}
								<label className="sr-only" htmlFor={`${id}-website`}>
									Website suggestion
								</label>
								<Input
									id={`${id}-website`}
									value={preview.websiteUrl}
									onChange={(event) =>
										setPreview({ ...preview, websiteUrl: event.target.value })
									}
									aria-invalid={preview.selectWebsite && !website.success}
									aria-describedby={`${id}-website-help`}
								/>
								{preview.selectWebsite && !website.success && (
									<p
										id={`${id}-website-help`}
										className="text-xs text-destructive"
									>
										Enter a valid HTTP or HTTPS website URL.
									</p>
								)}
							</div>
						</>
					)}
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setPreview(null)}
						>
							Cancel
						</Button>
						<Button type="button" disabled={!canApply} onClick={apply}>
							Apply selected
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	)
}
