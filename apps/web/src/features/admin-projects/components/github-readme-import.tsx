import { IconBrandGithub } from '@tabler/icons-react'
import { useEffect, useId, useRef, useState } from 'react'

import type { ORPCRouterOutputs } from '@altstack/api/routers'

import { repositoryUrlSchema } from '@altstack/shared/schemas/common'

import { Button } from '@altstack/ui/components/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@altstack/ui/components/dialog'
import { Spinner } from '@altstack/ui/components/spinner'

import type { BlockNoteEditorHandle } from '#/components/block-note/editor'
import type {
	ReadmeImportMode,
	ReadmeImportPreview,
} from '#/components/block-note/schema'
import { BlockNoteViewBlocks } from '#/components/block-note/view'
import { useAdminProjectGithubReadme } from '#/features/admin-projects/queries'

type Readme = ORPCRouterOutputs['admin']['project']['githubReadme']
type Preview = {
	readme: Readme
	requestedRepositoryUrl: string
	mode: ReadmeImportMode | null
	conversion: ReadmeImportPreview
}
const REPOSITORY_CHANGED =
	'Repository changed. Import README again to fetch its content.'

type GithubReadmeImportProps = {
	repositoryUrl: string
	disabled: boolean
	getRepositoryUrl: () => string
	getEditor: () => BlockNoteEditorHandle | null
}

export function GithubReadmeImport(props: GithubReadmeImportProps) {
	const [hasRequested, setHasRequested] = useState(false)
	return (
		<GithubReadmeImportSession
			key={props.repositoryUrl}
			{...props}
			hasRequested={hasRequested}
			onRequest={() => setHasRequested(true)}
		/>
	)
}

function GithubReadmeImportSession({
	repositoryUrl,
	disabled,
	getRepositoryUrl,
	getEditor,
	hasRequested,
	onRequest,
}: GithubReadmeImportProps & {
	hasRequested: boolean
	onRequest: () => void
}) {
	const { mutateAsync } = useAdminProjectGithubReadme()
	const id = useId()
	const requestId = useRef(0)
	const [pending, setPending] = useState(false)
	const [applying, setApplying] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [feedbackValue, setFeedback] = useState<string | null>()
	const feedback =
		feedbackValue === undefined
			? hasRequested
				? REPOSITORY_CHANGED
				: null
			: feedbackValue
	const [preview, setPreview] = useState<Preview | null>(null)
	useEffect(
		() => () => {
			requestId.current += 1
		},
		[]
	)

	function editor() {
		const current = getEditor()
		if (!current) {
			throw new Error('Content editor is still loading. Please try again.')
		}
		return current
	}
	async function fetchReadme() {
		if (
			disabled ||
			pending ||
			applying ||
			!repositoryUrlSchema.safeParse(repositoryUrl).success
		) {
			return
		}
		const requestedRepositoryUrl = repositoryUrl
		const currentRequest = ++requestId.current
		onRequest()
		setPending(true)
		setError(null)
		setFeedback(null)
		setPreview(null)
		await (async () => {
			try {
				const readme = await mutateAsync({
					repositoryUrl: requestedRepositoryUrl,
				})
				if (currentRequest !== requestId.current) return
				if (getRepositoryUrl() !== requestedRepositoryUrl) {
					setFeedback(REPOSITORY_CHANGED)
					return
				}
				const current = editor()
				const mode = current.readMarkdown().trim() ? null : 'replace'
				const conversion = current.previewImport(
					readme.markdown,
					mode ?? 'replace'
				)
				setPreview({ readme, requestedRepositoryUrl, mode, conversion })
			} catch (cause) {
				if (currentRequest === requestId.current) {
					setError(
						cause instanceof Error
							? cause.message
							: 'Unable to import README. Please try again.'
					)
				}
			}
		})().finally(() => {
			if (currentRequest === requestId.current) setPending(false)
		})
	}
	function chooseMode(mode: ReadmeImportMode) {
		if (!preview || disabled || applying) return
		try {
			const conversion = editor().previewImport(preview.readme.markdown, mode)
			setPreview({ ...preview, mode, conversion })
			setError(null)
			setFeedback(null)
		} catch (cause) {
			setError(
				cause instanceof Error ? cause.message : 'Unable to convert README.'
			)
		}
	}
	function apply() {
		if (!preview?.mode || disabled || pending || applying || error) return
		if (getRepositoryUrl() !== preview.requestedRepositoryUrl) {
			setPreview(null)
			setFeedback(REPOSITORY_CHANGED)
			return
		}
		setApplying(true)
		try {
			const result = editor().importMarkdown(
				preview.readme.markdown,
				preview.mode,
				preview.conversion.markdown
			)
			if (!result.applied) {
				setPreview({ ...preview, conversion: result })
				setFeedback(
					'Content changed. Review the updated preview, then Apply again.'
				)
			} else {
				setPreview(null)
				setFeedback(
					'README applied to Content. Save the project to persist it.'
				)
			}
		} catch (cause) {
			setError(
				cause instanceof Error
					? cause.message
					: 'Unable to apply README. Existing content was kept.'
			)
		}
		setApplying(false)
	}

	return (
		<div className="space-y-2">
			<Button
				type="button"
				variant="outline"
				size="sm"
				disabled={
					disabled ||
					pending ||
					applying ||
					!repositoryUrlSchema.safeParse(repositoryUrl).success
				}
				onClick={fetchReadme}
			>
				{pending ? <Spinner /> : <IconBrandGithub className="size-4" />}
				{pending ? 'Fetching README…' : 'Import README'}
			</Button>
			<p className="text-xs text-muted-foreground">
				Preview the public GitHub README and apply it to Content. Changes are
				saved with the project.
			</p>
			{error && !preview && (
				<p role="alert" className="text-sm text-destructive">
					{error} Click Import README to retry.
				</p>
			)}
			{feedback && !preview && (
				<output className="block text-sm text-muted-foreground">
					{feedback}
				</output>
			)}
			<ReadmeImportDialog
				preview={preview}
				setPreview={setPreview}
				applying={applying}
				disabled={disabled}
				pending={pending}
				error={error}
				setError={setError}
				feedback={feedback}
				setFeedback={setFeedback}
				id={id}
				chooseMode={chooseMode}
				apply={apply}
			/>
		</div>
	)
}

function ReadmeImportDialog({
	preview,
	setPreview,
	applying,
	disabled,
	pending,
	error,
	setError,
	feedback,
	setFeedback,
	id,
	chooseMode,
	apply,
}: {
	preview: Preview | null
	setPreview: (preview: Preview | null) => void
	applying: boolean
	disabled: boolean
	pending: boolean
	error: string | null
	setError: (error: string | null) => void
	feedback: string | null
	setFeedback: (feedback: string | null) => void
	id: string
	chooseMode: (mode: ReadmeImportMode) => void
	apply: () => void
}) {
	return (
		<Dialog
			open={preview !== null}
			onOpenChange={(open) => {
				if (!open && !applying) {
					setPreview(null)
					setError(null)
					setFeedback(null)
				}
			}}
		>
			<DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
				<DialogHeader>
					<DialogTitle>Import GitHub README</DialogTitle>
					<DialogDescription>
						GitHub-specific formatting can change during BlockNote conversion.
						Review the exact result below before applying. Save the project
						afterward to persist it.
					</DialogDescription>
				</DialogHeader>
				{preview && (
					<>
						<a
							href={preview.readme.sourceUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="text-sm break-all text-primary underline"
						>
							{preview.readme.repositoryUrl} · {preview.readme.path} ·{' '}
							{preview.readme.commitSha.slice(0, 7)}
						</a>
						{preview.readme.warnings.length > 0 && (
							<div className="rounded-lg border bg-muted/40 p-3 text-sm">
								<p className="mb-1 font-medium">Conversion warnings</p>
								<ul className="list-disc space-y-1 pl-5">
									{preview.readme.warnings.map((warning) => (
										<li key={warning}>{warning}</li>
									))}
								</ul>
							</div>
						)}
						<fieldset className="space-y-2" disabled={disabled || applying}>
							<legend className="mb-2 text-sm font-medium">
								How should this README be applied?
							</legend>
							{(['replace', 'append'] as const).map((mode) => (
								<label
									key={mode}
									htmlFor={`${id}-${mode}`}
									className="flex cursor-pointer items-center gap-2 text-sm"
								>
									<input
										id={`${id}-${mode}`}
										type="radio"
										name={id}
										checked={preview.mode === mode}
										onChange={() => chooseMode(mode)}
									/>
									{mode === 'replace' ? 'Replace content' : 'Append to content'}
								</label>
							))}
						</fieldset>
						{!preview.mode && (
							<p className="text-sm text-muted-foreground">
								Content already exists. Choose Replace or Append explicitly. The
								README conversion is shown until you choose.
							</p>
						)}
						{feedback && (
							<output className="block text-sm text-muted-foreground">
								{feedback}
							</output>
						)}
						{error && (
							<p role="alert" className="text-sm text-destructive">
								{error}
							</p>
						)}
						<section
							aria-label="README content preview"
							className="min-w-0 overflow-x-auto rounded-lg border p-4"
						>
							<BlockNoteViewBlocks blocks={preview.conversion.blocks} />
						</section>
					</>
				)}
				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						disabled={applying}
						onClick={() => {
							setPreview(null)
							setError(null)
							setFeedback(null)
						}}
					>
						Cancel
					</Button>
					<Button
						type="button"
						disabled={
							disabled || pending || applying || !preview?.mode || !!error
						}
						onClick={apply}
					>
						{applying ? 'Applying…' : 'Apply README'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
