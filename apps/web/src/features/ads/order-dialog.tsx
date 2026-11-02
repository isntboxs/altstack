import { Link } from '@tanstack/react-router'
import { useState } from 'react'

import { AD_PLANS } from '@altstack/shared/schemas/ad-billing'
import type { AdPlan } from '@altstack/shared/schemas/ad-billing'

import { Button } from '@altstack/ui/components/button'
import { Checkbox } from '@altstack/ui/components/checkbox'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@altstack/ui/components/dialog'
import {
	Field,
	FieldGroup,
	FieldLabel,
	FieldDescription,
} from '@altstack/ui/components/field'
import { Input } from '@altstack/ui/components/input'

import { client } from '#/utils/orpc'

export function AdOrderDialog({
	plan,
	onClose,
}: {
	plan: AdPlan | null
	onClose: () => void
}) {
	if (!plan) return null
	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open) onClose()
			}}
		>
			<DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
				<OrderForm key={plan} plan={plan} />
			</DialogContent>
		</Dialog>
	)
}

function OrderForm({ plan }: { plan: AdPlan }) {
	const [email, setEmail] = useState(''),
		[accepted, setAccepted] = useState(false),
		[busy, setBusy] = useState(false),
		[sent, setSent] = useState(false),
		[error, setError] = useState('')
	const item = AD_PLANS[plan]
	return (
		<>
			<DialogHeader>
				<DialogTitle>
					{sent ? 'Check your inbox' : `Advertise with ${item.name}`}
				</DialogTitle>
				<DialogDescription>
					{item.name} · US${item.amount / 100} for one month. Payment is
					arranged by email.
				</DialogDescription>
			</DialogHeader>
			{sent ? (
				<output className="leading-relaxed">
					Check your email for your private management link. Our team will
					contact you to arrange payment. Nothing has been charged.
				</output>
			) : (
				<form
					onSubmit={async (event) => {
						event.preventDefault()
						if (!accepted || busy) return
						setBusy(true)
						setError('')
						try {
							await client.adBilling.create({
								body: { plan, email, termsAccepted: true },
							})
							setSent(true)
						} catch {
							setError(
								'Unable to request an order. Your input is retained; wait a few minutes and try again.'
							)
						} finally {
							setBusy(false)
						}
					}}
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="ad-order-email">Contact email</FieldLabel>
							<Input
								id="ad-order-email"
								type="email"
								required
								maxLength={254}
								autoComplete="email"
								value={email}
								disabled={busy}
								onChange={(event) => setEmail(event.target.value)}
							/>
							<FieldDescription>
								We send your private order link here. No account needed.
							</FieldDescription>
						</Field>
						<Field orientation="horizontal">
							<Checkbox
								id="ad-terms"
								checked={accepted}
								disabled={busy}
								onCheckedChange={(value) => setAccepted(value === true)}
							/>
							<FieldLabel htmlFor="ad-terms" className="font-normal">
								<span>
									I accept the{' '}
									<Link
										to="/advertise/terms"
										target="_blank"
										className="underline underline-offset-4"
									>
										advertising terms
										<span className="sr-only"> (opens in a new tab)</span>
									</Link>{' '}
									and understand that payment and renewal are arranged manually.
								</span>
							</FieldLabel>
						</Field>
						<Button
							type="submit"
							className="min-h-11"
							disabled={busy || !accepted}
						>
							{busy
								? 'Requesting…'
								: `Request ${item.name} — US$${item.amount / 100}`}
						</Button>
						<p className="text-xs leading-relaxed text-muted-foreground">
							Your paid month starts after payment confirmation and material
							approval. No automatic billing.
						</p>
						{error && (
							<p role="alert" className="text-sm text-destructive">
								{error}
							</p>
						)}
					</FieldGroup>
				</form>
			)}
		</>
	)
}
