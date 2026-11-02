import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { AD_PLANS } from '@altstack/shared/schemas/ad-billing'
import type { AdOrderView } from '@altstack/shared/schemas/ad-billing'
import type { AdCampaign } from '@altstack/shared/schemas/ads'

import { Badge } from '@altstack/ui/components/badge'
import { Button } from '@altstack/ui/components/button'
import { Checkbox } from '@altstack/ui/components/checkbox'
import {
	Field,
	FieldGroup,
	FieldLabel,
	FieldDescription,
} from '@altstack/ui/components/field'
import { Input } from '@altstack/ui/components/input'
import { Textarea } from '@altstack/ui/components/textarea'

import { client, orpc } from '#/utils/orpc'
import { resolveFileUrl } from '#/utils/storage'
import { AdsAdmin } from './admin-editor'
import { AdCard } from './components'
import { inventoryOptions } from './provider'

export function AdvertisingAdmin() {
	const orders = useQuery(orpc.admin.adBilling.list.queryOptions({ input: {} }))
	const campaigns = useQuery(orpc.admin.ads.list.queryOptions({ input: {} }))
	const qc = useQueryClient()
	const refresh = async () => {
		await Promise.all([
			qc.invalidateQueries({ queryKey: orpc.admin.adBilling.key() }),
			qc.invalidateQueries({ queryKey: orpc.admin.ads.key() }),
			qc.invalidateQueries({
				queryKey: inventoryOptions().queryKey.slice(0, 2),
			}),
		])
	}
	return (
		<AdsAdmin
			managedCampaignIds={
				orders.data?.flatMap((order) =>
					order.campaignId ? [order.campaignId] : []
				) ?? []
			}
		>
			<section
				className="flex flex-col gap-4"
				aria-labelledby="ad-orders-title"
			>
				<div className="flex flex-wrap items-center justify-between gap-3">
					<h2 id="ad-orders-title" className="text-xl font-semibold">
						Advertising orders
					</h2>
					<Button variant="outline" onClick={() => void refresh()}>
						Refresh orders
					</Button>
				</div>
				<p className="text-sm text-muted-foreground">
					Coordinate payment by email. Record a payment only after checking that
					funds arrived. Confirming receipt does not move money. The first paid
					month starts at approval.
				</p>
				{orders.isPending && <output>Loading orders…</output>}
				{orders.isError && (
					<p role="alert">
						Unable to load advertising orders. Use Refresh orders to retry.
					</p>
				)}
				{orders.data?.length === 0 && (
					<p className="text-sm text-muted-foreground">
						No guest orders yet. Direct advertisers to /advertise.
					</p>
				)}
				{orders.data?.map((order) => (
					<OrderReview
						key={`${order.id}:${order.version}`}
						order={order}
						campaign={campaigns.data?.find(
							(campaign) => campaign.id === order.campaignId
						)}
						onSaved={refresh}
					/>
				))}
			</section>
		</AdsAdmin>
	)
}
type Payment = {
	id: string
	kind: 'initial' | 'renewal'
	amount: number
	reference: string
	confirmedBy: string | null
	createdAt: Date
}
function OrderReview({
	order,
	campaign,
	onSaved,
}: {
	order: AdOrderView & { payments: Array<Payment> }
	campaign?: AdCampaign
	onSaved: () => Promise<void>
}) {
	const [reason, setReason] = useState(''),
		[ctaText, setCtaText] = useState(campaign?.ctaText ?? 'Visit website'),
		[buttonColor, setButtonColor] = useState(
			campaign?.buttonColor ?? '#2563eb'
		),
		[reference, setReference] = useState(''),
		[confirmed, setConfirmed] = useState(false),
		[busy, setBusy] = useState(false),
		[error, setError] = useState('')
	const run = async (action: () => Promise<unknown>) => {
		if (busy) return
		setBusy(true)
		setError('')
		try {
			await action()
			await onSaved()
		} catch {
			setError(
				'Unable to save. The order may have changed or this payment reference may already be recorded. Refresh before retrying.'
			)
		} finally {
			setBusy(false)
		}
	}
	const review = (decision: 'approve' | 'revise' | 'reject') => {
		if (decision !== 'approve' && !reason.trim()) {
			setError('Provide feedback before requesting changes or declining.')
			return
		}
		void run(() =>
			client.admin.adBilling.review({
				body: {
					id: order.id,
					expectedVersion: order.version,
					decision,
					reason,
					ctaText,
					buttonColor,
				},
			})
		)
	}
	const preview = order.material
		? {
				...order.material,
				id: order.campaignId ?? order.id,
				version: 1,
				ctaText,
				buttonColor,
				tier: AD_PLANS[order.plan].tier,
				status: 'active' as const,
				startMonth: order.startsAt?.toISOString().slice(0, 7) ?? '2026-11',
				months: 1,
				startsAt: order.startsAt ?? new Date(0),
				endsAt: order.paidThrough ?? new Date(0),
				createdAt: order.createdAt,
				updatedAt: order.createdAt,
			}
		: null
	return (
		<article
			id={`order-${order.campaignId ?? order.id}`}
			className="flex scroll-mt-20 flex-col gap-5 rounded-xl border p-4 sm:p-5"
		>
			<header className="flex flex-wrap items-start justify-between gap-3">
				<div className="flex min-w-0 flex-col gap-2">
					<h3 className="font-semibold wrap-anywhere">
						{order.material?.name ?? AD_PLANS[order.plan].name + ' order'}
					</h3>
					<a
						className="text-sm wrap-anywhere underline underline-offset-4"
						href={`mailto:${order.email}?subject=${encodeURIComponent(`AltStack advertising order ${order.id}`)}`}
					>
						{order.email}
					</a>
					<p className="text-xs break-all text-muted-foreground">{order.id}</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Badge variant="outline">
						{AD_PLANS[order.plan].name} · US${order.amount / 100}
					</Badge>
					<Badge variant="secondary">{order.status.replaceAll('_', ' ')}</Badge>
					{order.renewalRequestedAt && <Badge>Renewal requested</Badge>}
				</div>
			</header>
			{order.paidThrough && (
				<p className="text-sm text-muted-foreground">
					Paid through{' '}
					{order.paidThrough.toISOString().replace('T', ' ').slice(0, 19)} UTC
					(exclusive). Campaign {campaign?.status ?? 'loading'}.
				</p>
			)}
			{order.feedback && (
				<p className="text-sm">Previous feedback: {order.feedback}</p>
			)}
			{(order.status === 'pending_payment' || order.renewalRequestedAt) && (
				<form
					onSubmit={(event) => {
						event.preventDefault()
						if (!confirmed) return
						void run(() =>
							client.admin.adBilling.confirmPayment({
								body: {
									id: order.id,
									expectedVersion: order.version,
									kind: order.paidAt ? 'renewal' : 'initial',
									reference,
								},
							})
						)
					}}
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor={`payment-${order.id}`}>
								{order.paidAt ? 'Renewal' : 'Initial'} payment reference
							</FieldLabel>
							<Input
								id={`payment-${order.id}`}
								required
								minLength={3}
								maxLength={200}
								value={reference}
								onChange={(event) => setReference(event.target.value)}
							/>
							<FieldDescription>
								Unique bank or payment reference agreed by email. Amount: US$
								{order.amount / 100}. Record any conversion details in your
								payment correspondence.
							</FieldDescription>
						</Field>
						<Field orientation="horizontal">
							<Checkbox
								id={`verified-${order.id}`}
								checked={confirmed}
								onCheckedChange={(value) => setConfirmed(value === true)}
							/>
							<FieldLabel htmlFor={`verified-${order.id}`}>
								I independently verified receipt of this payment.
							</FieldLabel>
						</Field>
						<Button
							className="self-start"
							type="submit"
							disabled={busy || !confirmed}
						>
							{busy ? 'Saving…' : 'Record received payment'}
						</Button>
					</FieldGroup>
				</form>
			)}
			{preview && (
				<div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
					<div className="self-start">
						<AdCard ad={preview} />
						{order.plan !== 'core' && (
							<figure className="mt-4 flex flex-col gap-2">
								<figcaption className="text-sm text-muted-foreground">
									Sponsor grid artwork
								</figcaption>
								<img
									src={resolveFileUrl(order.material!.banner)}
									alt={`${order.material!.name} sponsor wordmark`}
									width={450}
									height={150}
									className="aspect-[3/1] w-full rounded-lg border object-contain"
								/>
							</figure>
						)}
						<a
							href={order.material!.websiteUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="mt-3 inline-block text-sm wrap-anywhere underline underline-offset-4"
						>
							Review advertiser website
						</a>
					</div>
					{order.status === 'in_review' && (
						<FieldGroup>
							<Field>
								<FieldLabel htmlFor={`cta-${order.id}`}>CTA text</FieldLabel>
								<Input
									id={`cta-${order.id}`}
									maxLength={40}
									value={ctaText}
									onChange={(event) => setCtaText(event.target.value)}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor={`color-${order.id}`}>
									CTA button color
								</FieldLabel>
								<Input
									id={`color-${order.id}`}
									type="color"
									value={buttonColor}
									onChange={(event) => setButtonColor(event.target.value)}
								/>
								<FieldDescription>
									Choose a brand color; text contrast adjusts automatically.
								</FieldDescription>
							</Field>
							<Field>
								<FieldLabel htmlFor={`feedback-${order.id}`}>
									Review feedback
								</FieldLabel>
								<Textarea
									id={`feedback-${order.id}`}
									maxLength={1000}
									value={reason}
									onChange={(event) => setReason(event.target.value)}
								/>
								<FieldDescription>
									Required for changes or a decline.{' '}
									{order.campaignId
										? 'Declining a revision preserves the previous live artwork.'
										: 'If declining this first campaign, coordinate the refund manually by email.'}
								</FieldDescription>
							</Field>
							<div className="flex flex-wrap gap-2">
								<Button
									disabled={busy || !ctaText.trim()}
									onClick={() => review('approve')}
								>
									Approve materials
								</Button>
								<Button
									variant="outline"
									disabled={busy}
									onClick={() => review('revise')}
								>
									Request changes
								</Button>
								<Button
									variant="destructive"
									disabled={busy}
									onClick={() => review('reject')}
								>
									Decline materials
								</Button>
							</div>
						</FieldGroup>
					)}
				</div>
			)}
			{order.campaignId && campaign && (
				<Button
					className="self-start"
					variant="outline"
					disabled={busy}
					onClick={() =>
						void run(() =>
							client.admin.adBilling.setStatus({
								body: {
									id: order.id,
									expectedVersion: order.version,
									status: campaign.status === 'active' ? 'inactive' : 'active',
								},
							})
						)
					}
				>
					{campaign.status === 'active'
						? 'Deactivate campaign'
						: 'Activate campaign'}
				</Button>
			)}
			{order.payments.length > 0 && (
				<details>
					<summary className="cursor-pointer text-sm font-medium">
						Payment confirmations ({order.payments.length})
					</summary>
					<ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-sm">
						{order.payments.map((payment) => (
							<li key={payment.id} className="wrap-anywhere">
								{payment.kind} · US${payment.amount / 100} · {payment.reference}{' '}
								· {payment.createdAt.toISOString().slice(0, 10)} UTC
							</li>
						))}
					</ul>
				</details>
			)}
			{error && (
				<p role="alert" className="text-sm text-destructive">
					{error}
				</p>
			)}
		</article>
	)
}
