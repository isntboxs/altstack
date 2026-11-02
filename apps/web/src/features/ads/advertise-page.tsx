import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'

import { AD_PLANS, adPlanSchema } from '@altstack/shared/schemas/ad-billing'
import type { AdPlan } from '@altstack/shared/schemas/ad-billing'

import { Button } from '@altstack/ui/components/button'
import { Checkbox } from '@altstack/ui/components/checkbox'
import {
	Field,
	FieldGroup,
	FieldLabel,
	FieldDescription,
} from '@altstack/ui/components/field'
import { Input } from '@altstack/ui/components/input'
import { Separator } from '@altstack/ui/components/separator'

import { client, orpc } from '#/utils/orpc'
import { AdAccessRequest } from './order-access'

export function AdvertisePage() {
	const config = useQuery(orpc.adBilling.config.queryOptions({ input: {} }))
	const [plan, setPlan] = useState<AdPlan>('plus'),
		[email, setEmail] = useState(''),
		[accepted, setAccepted] = useState(false),
		[busy, setBusy] = useState(false),
		[sent, setSent] = useState(false),
		[error, setError] = useState('')
	return (
		<article className="container mx-auto flex max-w-4xl flex-col gap-10 px-4 pt-28 pb-16">
			<header className="flex max-w-2xl flex-col gap-4">
				<h1 className="text-3xl font-semibold">Advertise on AltStack</h1>
				<p className="text-muted-foreground">
					Put your product alongside the open-source projects people come here
					to find. Choose a monthly placement package and arrange payment with
					our team by email.
				</p>
			</header>
			<section
				aria-label="Monthly advertising packages"
				className="divide-y rounded-xl border"
			>
				{adPlanSchema.options.map((key) => {
					const item = AD_PLANS[key]
					return (
						<div
							key={key}
							className="grid gap-3 p-5 sm:grid-cols-[8rem_1fr_8rem] sm:items-center"
						>
							<h2 className="text-lg font-semibold">{item.name}</h2>
							<p className="text-sm text-muted-foreground">
								{item.description}
							</p>
							<p className="sm:text-right">
								<strong className="text-xl">US${item.amount / 100}</strong>
								<span className="block text-sm text-muted-foreground">
									per month
								</span>
							</p>
						</div>
					)
				})}
			</section>
			<div className="flex flex-col gap-3 text-sm text-muted-foreground">
				<p>
					Launch pricing in USD. There are no guaranteed views or clicks.
					Priority has twice the selection weight of Plus where they share a
					placement; rotation intervals are the same. If all eligible
					advertisers fit, all may appear.
				</p>
				<p>
					Your first month starts when payment is confirmed and your materials
					are approved. No automatic billing. Renew only when you choose to
					arrange another payment.
				</p>
			</div>
			<section
				className="flex max-w-xl flex-col gap-5"
				aria-labelledby="ad-order-title"
			>
				<h2 id="ad-order-title" className="text-xl font-semibold">
					Request an advertising order
				</h2>
				<p className="text-sm text-muted-foreground">
					We email you a private management link and coordinate payment. Once
					payment is confirmed, upload your logo, short description, website,
					and horizontal artwork for review.
				</p>
				{config.isError && (
					<p role="alert">
						Unable to check availability.{' '}
						<Button variant="outline" onClick={() => void config.refetch()}>
							Retry
						</Button>
					</p>
				)}
				{config.data && !config.data.available && (
					<output className="text-muted-foreground">
						Advertising orders are temporarily unavailable. Please check back
						later.
					</output>
				)}
				{sent ? (
					<output>
						Check your email for your private management link. Our team will
						contact you to arrange payment. Nothing has been charged.
					</output>
				) : (
					<form
						onSubmit={async (event) => {
							event.preventDefault()
							if (!accepted) return
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
								<FieldLabel htmlFor="ad-plan">Package</FieldLabel>
								<select
									id="ad-plan"
									className="h-10 rounded-md border bg-background px-3 text-sm"
									value={plan}
									onChange={(event) =>
										setPlan(adPlanSchema.parse(event.target.value))
									}
								>
									{adPlanSchema.options.map((key) => (
										<option key={key} value={key}>
											{AD_PLANS[key].name} — US${AD_PLANS[key].amount / 100}
											/month
										</option>
									))}
								</select>
							</Field>
							<Field>
								<FieldLabel htmlFor="ad-order-email">Contact email</FieldLabel>
								<Input
									id="ad-order-email"
									type="email"
									required
									maxLength={254}
									autoComplete="email"
									value={email}
									onChange={(event) => setEmail(event.target.value)}
								/>
								<FieldDescription>
									Use an inbox you can access. Management links expire after 24
									hours.
								</FieldDescription>
							</Field>
							<Field orientation="horizontal">
								<Checkbox
									id="ad-terms"
									checked={accepted}
									onCheckedChange={(value) => setAccepted(value === true)}
								/>
								<FieldLabel htmlFor="ad-terms" className="font-normal">
									I accept the{' '}
									<Link
										to="/advertise/terms"
										className="underline underline-offset-4"
									>
										advertising terms
									</Link>{' '}
									and understand that payment and renewal are arranged manually.
								</FieldLabel>
							</Field>
							<Button
								type="submit"
								disabled={busy || !accepted || !config.data?.available}
							>
								{busy
									? 'Requesting…'
									: `Request ${AD_PLANS[plan].name} — US$${AD_PLANS[plan].amount / 100}`}
							</Button>
							{error && (
								<p role="alert" className="text-sm text-destructive">
									{error}
								</p>
							)}
						</FieldGroup>
					</form>
				)}
				{config.data?.contactEmail && (
					<p className="text-sm text-muted-foreground">
						Questions?{' '}
						<a
							href={`mailto:${config.data.contactEmail}`}
							className="underline underline-offset-4"
						>
							Email our advertising team
						</a>
						.
					</p>
				)}
			</section>
			<Separator />
			<div className="max-w-xl">
				<AdAccessRequest />
			</div>
		</article>
	)
}
