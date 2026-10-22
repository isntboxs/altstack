import { useMutation } from '@tanstack/react-query'
import { useId, useRef, useState } from 'react'

import type { ORPCRouterInputs } from '@altstack/api/routers'

import {
	guestReportBodySchema,
	reportBodySchema,
	reportMessageMaxLength,
	reportTypes,
} from '@altstack/shared/schemas/report'

import { Alert, AlertDescription } from '@altstack/ui/components/alert'
import { Button } from '@altstack/ui/components/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@altstack/ui/components/dialog'
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from '@altstack/ui/components/field'
import { Input } from '@altstack/ui/components/input'
import { RadioGroup, RadioGroupItem } from '@altstack/ui/components/radio-group'
import { Spinner } from '@altstack/ui/components/spinner'
import { Textarea } from '@altstack/ui/components/textarea'
import { toast } from '@altstack/ui/components/toast'

import { client } from '#/utils/orpc'

export function ProjectReportDialog({
	projectId,
	name,
	userId,
	open,
	onOpenChange,
	finalFocus,
}: {
	projectId: string
	name: string
	userId: string | undefined
	open: boolean
	onOpenChange: (open: boolean) => void
	finalFocus: () => HTMLElement | null
}) {
	const id = useId()
	const [email, setEmail] = useState('')
	const [type, setType] = useState('')
	const [message, setMessage] = useState('')
	const [errors, setErrors] = useState<Record<string, string>>({})
	const formRef = useRef<HTMLFormElement>(null)
	const sending = useRef(false)
	const mutation = useMutation({
		mutationFn: (input: ORPCRouterInputs['report']['create']) =>
			client.report.create(input),
		retry: false,
	})

	async function send(event: React.SyntheticEvent) {
		event.preventDefault()
		if (sending.current) return
		const parsed = (
			userId ? reportBodySchema : guestReportBodySchema
		).safeParse({
			type,
			message,
			...(userId ? {} : { email }),
		})
		if (!parsed.success) {
			const nextErrors: Record<string, string> = {}
			for (const issue of parsed.error.issues) {
				nextErrors[String(issue.path[0])] = issue.message
			}
			setErrors(nextErrors)
			const first = parsed.error.issues[0]?.path[0]
			formRef.current
				?.querySelector<HTMLElement>(`[data-report-field="${String(first)}"]`)
				?.focus()
			return
		}
		setErrors({})
		sending.current = true
		try {
			await mutation.mutateAsync({
				params: { id: projectId },
				body: parsed.data,
			})
			setEmail('')
			setType('')
			setMessage('')
			toast.add({
				type: 'success',
				title: 'Report sent',
				description: 'Thanks for helping keep AltStack accurate.',
			})
			onOpenChange(false)
		} catch {
			// Keep all entries for an explicit retry; never claim success on failure.
		} finally {
			sending.current = false
		}
	}
	const errorMessage =
		mutation.error &&
		'code' in mutation.error &&
		mutation.error.code === 'TOO_MANY_REQUESTS'
			? 'Too many reports. Please wait a few minutes before trying again.'
			: mutation.error &&
				  'code' in mutation.error &&
				  mutation.error.code === 'NOT_FOUND'
				? 'This project is no longer available for reports.'
				: 'Unable to send your report. Please try again.'
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="max-h-[calc(100dvh-2rem)] min-w-0 overflow-y-auto sm:max-w-md"
				finalFocus={finalFocus}
			>
				<DialogHeader className="min-w-0 pr-6">
					<DialogTitle className="wrap-anywhere">Report {name}</DialogTitle>
					<DialogDescription>
						What is happening with this tool?
					</DialogDescription>
				</DialogHeader>
				<form
					ref={formRef}
					onSubmit={send}
					noValidate
					className="flex min-w-0 flex-col gap-5"
					aria-busy={mutation.isPending}
				>
					<FieldGroup className="gap-5">
						{!userId && (
							<Field data-invalid={Boolean(errors.email)}>
								<FieldLabel htmlFor={`${id}-email`}>
									Email <span aria-hidden="true">*</span>
								</FieldLabel>
								<Input
									id={`${id}-email`}
									data-report-field="email"
									type="email"
									autoComplete="email"
									required
									maxLength={254}
									placeholder="Your email"
									value={email}
									onChange={(event) => setEmail(event.target.value)}
									aria-invalid={Boolean(errors.email)}
									aria-describedby={
										errors.email ? `${id}-email-error` : undefined
									}
								/>
								{errors.email && (
									<FieldError id={`${id}-email-error`}>
										{errors.email}
									</FieldError>
								)}
							</Field>
						)}
						<FieldSet data-invalid={Boolean(errors.type)}>
							<FieldLegend id={`${id}-type-label`} variant="label">
								Type <span aria-hidden="true">*</span>
							</FieldLegend>
							<RadioGroup
								aria-labelledby={`${id}-type-label`}
								aria-required="true"
								aria-invalid={Boolean(errors.type)}
								aria-describedby={errors.type ? `${id}-type-error` : undefined}
								value={type}
								onValueChange={(value) => setType(String(value))}
							>
								{reportTypes.map((option, index) => (
									<Field key={option.value} orientation="horizontal">
										<RadioGroupItem
											id={`${id}-${option.value}`}
											value={option.value}
											data-report-field={index === 0 ? 'type' : undefined}
											aria-invalid={Boolean(errors.type)}
										/>
										<FieldLabel htmlFor={`${id}-${option.value}`}>
											{option.label}
										</FieldLabel>
									</Field>
								))}
							</RadioGroup>
							{errors.type && (
								<FieldError id={`${id}-type-error`}>
									Please choose a report type.
								</FieldError>
							)}
						</FieldSet>
						<Field data-invalid={Boolean(errors.message)}>
							<FieldLabel htmlFor={`${id}-message`}>
								Message {type === 'other' && <span aria-hidden="true">*</span>}
							</FieldLabel>
							<Textarea
								id={`${id}-message`}
								data-report-field="message"
								rows={4}
								className="field-sizing-fixed min-h-24"
								placeholder="Provide additional details about the issue…"
								required={type === 'other'}
								maxLength={reportMessageMaxLength}
								value={message}
								onChange={(event) => setMessage(event.target.value)}
								aria-invalid={Boolean(errors.message)}
								aria-describedby={
									errors.message ? `${id}-message-error` : undefined
								}
							/>
							{errors.message && (
								<FieldError id={`${id}-message-error`}>
									{errors.message}
								</FieldError>
							)}
						</Field>
					</FieldGroup>
					{mutation.isError && (
						<Alert variant="destructive">
							<AlertDescription role="alert">{errorMessage}</AlertDescription>
						</Alert>
					)}
					<DialogFooter className="flex-row justify-between sm:justify-between">
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={mutation.isPending}>
							{mutation.isPending && (
								<Spinner data-icon="inline-start" aria-hidden="true" />
							)}
							{mutation.isPending ? 'Sending…' : 'Send'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
