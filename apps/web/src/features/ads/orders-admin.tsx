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

const statusLabels = {
	pending_payment: 'Awaiting payment',
	awaiting_materials: 'Awaiting materials',
	in_review: 'Ready for review',
	changes_requested: 'Changes requested',
	approved: 'Approved',
	rejected: 'Declined',
} satisfies Record<AdOrderView['status'], string>

function needsAttention(order: AdOrderView) {
	return (
		order.status === 'pending_payment' ||
		order.status === 'in_review' ||
		!!order.renewalRequestedAt
	)
}

export function AdvertisingAdmin() {
	const orders = useQuery(orpc.admin.adBilling.list.queryOptions({ input: {} }))
	const campaigns = useQuery(orpc.admin.ads.list.queryOptions({ input: {} }))
	const qc = useQueryClient()
	const [search, setSearch] = useState('')
	const [status, setStatus] = useState('all')
	const [expandedOrderId, setExpandedOrderId] = useState<string>()
	const filtered = orders.data?.filter((order) => {
		const matchesStatus =
			status === 'all' ||
			(status === 'attention' ? needsAttention(order) : order.status === status)
		const text =
			`${order.material?.name ?? ''} ${order.email} ${order.id}`.toLowerCase()
		return matchesStatus && text.includes(search.trim().toLowerCase())
	})
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
			onManageOrder={(campaignId) => {
				setSearch('')
				setStatus('all')
				setExpandedOrderId(
					orders.data?.find((order) => order.campaignId === campaignId)?.id
				)
			}}
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
					<div className="flex flex-col gap-1">
						<h2 id="ad-orders-title" className="text-lg font-semibold">
							Advertiser orders
						</h2>
						<p className="text-sm text-muted-foreground">
							{orders.data
								? `${orders.data.filter(needsAttention).length} to follow up · ${orders.data.length} ${orders.data.length === 1 ? 'order' : 'orders'}`
								: 'Payments, materials, and renewals in one place.'}
						</p>
					</div>
					<Button
						variant="outline"
						disabled={orders.isFetching}
						onClick={() => void refresh()}
					>
						Refresh orders
					</Button>
				</div>
				<div className="grid gap-3 rounded-xl border bg-muted/20 p-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
					<Field className="gap-2">
						<FieldLabel htmlFor="ad-order-search">Search orders</FieldLabel>
						<Input
							id="ad-order-search"
							type="search"
							className="bg-background"
							placeholder="Name, email, or order reference"
							value={search}
							onChange={(event) => setSearch(event.target.value)}
						/>
					</Field>
					<Field className="gap-2">
						<FieldLabel htmlFor="ad-order-status">Status</FieldLabel>
						<select
							id="ad-order-status"
							className="h-8 w-full rounded-lg border bg-background px-3 text-sm"
							value={status}
							onChange={(event) => setStatus(event.target.value)}
						>
							<option value="all">All orders</option>
							<option value="attention">Needs attention</option>
							{Object.entries(statusLabels).map(([value, label]) => (
								<option key={value} value={value}>
									{label}
								</option>
							))}
						</select>
					</Field>
				</div>
				{orders.isPending && <output>Loading orders…</output>}
				{orders.isError && (
					<p role="alert">
						Unable to load advertising orders. Use Refresh orders to retry.
					</p>
				)}
				{orders.data?.length === 0 && (
					<div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center">
						<h3 className="font-medium">No advertiser orders yet</h3>
						<p className="max-w-sm text-sm text-muted-foreground">
							Orders appear here when an advertiser chooses a package.
						</p>
						<a
							href="/advertise"
							className="inline-flex items-center text-sm underline underline-offset-4"
						>
							View advertising packages
						</a>
					</div>
				)}
				{orders.data && orders.data.length > 0 && filtered?.length === 0 && (
					<div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
						<p className="font-medium">No matching orders</p>
						<p className="text-sm text-muted-foreground">
							Try another name, email, or status.
						</p>
						<Button
							variant="outline"
							onClick={() => {
								setSearch('')
								setStatus('all')
							}}
						>
							Clear filters
						</Button>
					</div>
				)}
				{filtered?.map((order) => (
					<OrderReview
						key={`${order.id}:${order.version}`}
						order={order}
						expanded={expandedOrderId === order.id}
						onExpandedChange={() =>
							setExpandedOrderId(
								expandedOrderId === order.id ? undefined : order.id
							)
						}
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
	expanded,
	onExpandedChange,
}: {
	order: AdOrderView & { payments: Array<Payment> }
	campaign?: AdCampaign
	onSaved: () => Promise<void>
	expanded: boolean
	onExpandedChange: () => void
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
		await (async () => {
			try {
				await action()
				await onSaved()
			} catch {
				setError(
					'Unable to save. The order may have changed or this payment reference may already be recorded. Refresh before retrying.'
				)
			}
		})().finally(() => {
			setBusy(false)
		})
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
	const preview = getOrderPreview(order, ctaText, buttonColor)
	return (
		<article
			id={`order-${order.campaignId ?? order.id}`}
			className="min-w-0 scroll-mt-20 overflow-hidden rounded-xl border bg-card"
		>
			<OrderReviewHeader
				order={order}
				expanded={expanded}
				onExpandedChange={onExpandedChange}
			/>
			{expanded && (
				<div
					id={`order-details-${order.id}`}
					className="flex min-w-0 flex-col gap-6 border-t p-4 sm:p-5"
				>
					<OrderReviewSummary order={order} campaign={campaign} />
					{order.feedback && (
						<p className="text-sm">Previous feedback: {order.feedback}</p>
					)}
					{(order.status === 'pending_payment' || order.renewalRequestedAt) && (
						<OrderPaymentConfirmation
							order={order}
							confirmed={confirmed}
							setConfirmed={setConfirmed}
							reference={reference}
							setReference={setReference}
							busy={busy}
							run={run}
						/>
					)}
					<OrderMaterialsReview
						order={order}
						preview={preview}
						ctaText={ctaText}
						setCtaText={setCtaText}
						buttonColor={buttonColor}
						setButtonColor={setButtonColor}
						reason={reason}
						setReason={setReason}
						busy={busy}
						review={review}
					/>
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
											status:
												campaign.status === 'active' ? 'inactive' : 'active',
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
										{payment.kind} · US${payment.amount / 100} ·{' '}
										{payment.reference} ·{' '}
										{payment.createdAt.toISOString().slice(0, 10)} UTC
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
				</div>
			)}
		</article>
	)
}

function OrderPaymentConfirmation({
	order,
	confirmed,
	setConfirmed,
	reference,
	setReference,
	busy,
	run,
}: {
	order: AdOrderView
	confirmed: boolean
	setConfirmed: (confirmed: boolean) => void
	reference: string
	setReference: (reference: string) => void
	busy: boolean
	run: (action: () => Promise<unknown>) => Promise<void>
}) {
	return (
		<form
			className="flex flex-col gap-4 rounded-lg border p-4 sm:p-5"
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
			<div className="flex flex-col gap-1">
				<h4 className="font-semibold">
					Confirm {order.paidAt ? 'renewal' : 'initial'} payment
				</h4>
				<p className="text-sm text-muted-foreground">
					Match the Ko-fi receipt to this order and verify that US$
					{order.amount / 100} arrived. Recording a payment does not charge the
					advertiser.
				</p>
			</div>
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
						Unique transaction reference from the Ko-fi payment receipt. Amount:
						US$
						{order.amount / 100}. Record any conversion details in your payment
						correspondence.
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
	)
}

function OrderReviewHeader({
	order,
	expanded,
	onExpandedChange,
}: {
	order: AdOrderView
	expanded: boolean
	onExpandedChange: () => void
}) {
	return (
		<header className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
			<div className="flex min-w-0 flex-1 flex-col gap-1">
				<h3 className="font-semibold wrap-anywhere">
					{order.material?.name ?? AD_PLANS[order.plan].name + ' order'}
				</h3>
				<p className="text-sm wrap-anywhere text-muted-foreground">
					{order.email}
				</p>
				<p className="text-xs text-muted-foreground">
					{AD_PLANS[order.plan].name} · US${order.amount / 100} / month
				</p>
			</div>
			<div className="flex shrink-0 flex-wrap items-center gap-3">
				<Badge variant={needsAttention(order) ? 'default' : 'secondary'}>
					{order.renewalRequestedAt
						? 'Renewal requested'
						: statusLabels[order.status]}
				</Badge>
				<Button
					variant="outline"
					aria-expanded={expanded}
					aria-controls={expanded ? `order-details-${order.id}` : undefined}
					onClick={onExpandedChange}
				>
					{expanded
						? 'Close details'
						: needsAttention(order)
							? 'Review order'
							: 'View details'}
				</Button>
			</div>
		</header>
	)
}

function getOrderPreview(
	order: AdOrderView,
	ctaText: string,
	buttonColor: string
) {
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
	return preview
}

function OrderMaterialsReview({
	order,
	preview,
	ctaText,
	setCtaText,
	buttonColor,
	setButtonColor,
	reason,
	setReason,
	busy,
	review,
}: {
	order: AdOrderView
	preview: ReturnType<typeof getOrderPreview>
	ctaText: string
	setCtaText: (text: string) => void
	buttonColor: string
	setButtonColor: (color: string) => void
	reason: string
	setReason: (reason: string) => void
	busy: boolean
	review: (decision: 'approve' | 'revise' | 'reject') => void
}) {
	return (
		<>
			{preview && (
				<div
					className={
						order.status === 'in_review'
							? 'grid min-w-0 gap-6 xl:grid-cols-2'
							: 'grid min-w-0 gap-6'
					}
				>
					<div
						className={
							order.status === 'in_review'
								? 'flex min-w-0 flex-col gap-4'
								: 'grid min-w-0 items-start gap-5 sm:grid-cols-2'
						}
					>
						<h4 className="col-span-full font-semibold">Submitted materials</h4>
						<div className="max-w-sm">
							<AdCard ad={preview} />
						</div>
						{order.plan !== 'core' && (
							<figure className="flex min-w-0 flex-col gap-2">
								<figcaption className="text-sm text-muted-foreground">
									Sponsor grid artwork
								</figcaption>
								<img
									src={resolveFileUrl(order.material!.banner)}
									alt={`${order.material!.name} sponsor wordmark`}
									width={450}
									height={150}
									className="aspect-[3/1] w-full max-w-sm rounded-lg border bg-muted/20 object-contain"
								/>
							</figure>
						)}
						<a
							href={order.material!.websiteUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="col-span-full inline-flex items-center text-sm wrap-anywhere underline underline-offset-4"
						>
							Review advertiser website
						</a>
					</div>
					{order.status === 'in_review' && (
						<FieldGroup className="min-w-0 rounded-lg border p-4 sm:p-5">
							<h4 className="font-semibold">Review materials</h4>
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
		</>
	)
}

function OrderReviewSummary({
	order,
	campaign,
}: {
	order: AdOrderView
	campaign?: AdCampaign
}) {
	return (
		<dl className="grid gap-4 rounded-lg bg-muted/30 p-4 text-sm sm:grid-cols-2">
			<div className="flex min-w-0 flex-col gap-1">
				<dt className="text-muted-foreground">Order reference</dt>
				<dd className="break-all">{order.id}</dd>
			</div>
			<div className="flex min-w-0 flex-col gap-1">
				<dt className="text-muted-foreground">Contact advertiser</dt>
				<dd>
					<a
						className="wrap-anywhere underline underline-offset-4"
						href={`mailto:${order.email}?subject=${encodeURIComponent(`AltStack advertising order ${order.id}`)}`}
					>
						{order.email}
					</a>
				</dd>
			</div>
			{order.paidThrough && (
				<div className="flex flex-col gap-1">
					<dt className="text-muted-foreground">
						Paid through (UTC, exclusive)
					</dt>
					<dd>
						{order.paidThrough.toISOString().replace('T', ' ').slice(0, 16)}
					</dd>
				</div>
			)}
			{order.campaignId && (
				<div className="flex flex-col gap-1">
					<dt className="text-muted-foreground">Campaign status</dt>
					<dd className="capitalize">{campaign?.status ?? 'Loading…'}</dd>
				</div>
			)}
		</dl>
	)
}
