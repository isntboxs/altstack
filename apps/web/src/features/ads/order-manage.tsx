import { useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import {
	SCREENSHOT_MAX_SIZE,
	SCREENSHOT_MIME,
} from '@altstack/shared/constants'
import { AD_PLANS, adCreativeSchema } from '@altstack/shared/schemas/ad-billing'
import type {
	AdAccess,
	AdCreative,
	AdOrderView,
} from '@altstack/shared/schemas/ad-billing'

import {
	Alert,
	AlertDescription,
	AlertTitle,
} from '@altstack/ui/components/alert'
import { Button, buttonVariants } from '@altstack/ui/components/button'
import {
	Field,
	FieldGroup,
	FieldLabel,
	FieldDescription,
} from '@altstack/ui/components/field'
import { Input } from '@altstack/ui/components/input'

import { ImageUploader, LogoUploader } from '#/components/image-uploader'
import type { ImageUploadEndpoints } from '#/components/use-image-upload'
import { client } from '#/utils/orpc'
import { resolveFileUrl } from '#/utils/storage'
import { captureAdAccess, forgetAdAccess } from './management-access'
import { AdAccessRequest } from './order-access'

async function loadPrivateOrder() {
	const access = captureAdAccess()
	if (!access) return { access, order: undefined, error: '' }
	try {
		return {
			access,
			order: await client.adBilling.get({ body: access }),
			error: '',
		}
	} catch {
		return {
			access,
			order: undefined,
			error:
				'This private link may have expired. Request a fresh link below, or retry.',
		}
	}
}

export function AdOrderManage() {
	const [access, setAccess] = useState<AdAccess | null>(null),
		[order, setOrder] = useState<AdOrderView>(),
		[loading, setLoading] = useState(true),
		[error, setError] = useState(''),
		[editing, setEditing] = useState(false),
		[busy, setBusy] = useState(false),
		[loadedAt, setLoadedAt] = useState(0)
	const router = useRouter()
	useEffect(() => {
		let active = true
		// Keep bearer credentials and private order data out of query caches/logged keys.
		void loadPrivateOrder().then((result) => {
			if (!active) return
			setAccess(result.access)
			setOrder(result.order)
			setError(result.error)
			setLoadedAt(Date.now())
			setLoading(false)
		})
		return () => {
			active = false
		}
	}, [])
	const refresh = async () => {
		if (!access) return
		setLoading(true)
		setError('')
		try {
			setOrder(await client.adBilling.get({ body: access }))
			setLoadedAt(Date.now())
		} catch {
			setError(
				'Unable to load this order. Request a fresh link if yours has expired.'
			)
		} finally {
			setLoading(false)
		}
	}
	return (
		<article className="container mx-auto flex max-w-3xl flex-col gap-7 px-4 pt-28 pb-16">
			<header className="flex flex-col gap-3">
				<h1 className="text-3xl font-semibold">Your advertising order</h1>
				<p className="text-sm text-muted-foreground">
					Keep this page private. Pay through Ko-fi; our team confirms receipt
					by email.
				</p>
			</header>
			{loading && <output>Loading your order…</output>}
			{error && (
				<Alert variant="destructive">
					<AlertTitle>Unable to update order</AlertTitle>
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}
			{access && (
				<div className="flex flex-wrap gap-3">
					<Button
						variant="outline"
						disabled={loading || busy}
						onClick={() => void refresh()}
					>
						Refresh order
					</Button>
					<Button
						variant="ghost"
						onClick={async () => {
							forgetAdAccess()
							setOrder(undefined)
							setAccess(null)
							await router.navigate({ to: '/advertise' })
						}}
					>
						Close private page
					</Button>
				</div>
			)}
			{order && access && (
				<>
					<dl className="grid gap-5 rounded-xl border p-5 sm:grid-cols-2">
						<div>
							<dt className="text-sm text-muted-foreground">Package</dt>
							<dd className="font-medium">
								{AD_PLANS[order.plan].name} · US${order.amount / 100}/month
							</dd>
						</div>
						<div>
							<dt className="text-sm text-muted-foreground">Status</dt>
							<dd className="capitalize">
								{order.status.replaceAll('_', ' ')}
								{order.paidThrough && order.paidThrough.getTime() <= loadedAt
									? ' · Period ended'
									: ''}
							</dd>
						</div>
						<div>
							<dt className="text-sm text-muted-foreground">Order reference</dt>
							<dd className="text-sm break-all">{order.id}</dd>
						</div>
						<div>
							<dt className="text-sm text-muted-foreground">Contact</dt>
							<dd className="text-sm break-all">{order.email}</dd>
						</div>
						{order.startsAt && (
							<div>
								<dt className="text-sm text-muted-foreground">
									First approved
								</dt>
								<dd>
									{order.startsAt.toISOString().replace('T', ' ').slice(0, 19)}{' '}
									UTC
								</dd>
							</div>
						)}
						{order.paidThrough && (
							<div>
								<dt className="text-sm text-muted-foreground">
									Paid through (exclusive)
								</dt>
								<dd>
									{order.paidThrough
										.toISOString()
										.replace('T', ' ')
										.slice(0, 19)}{' '}
									UTC
								</dd>
							</div>
						)}
					</dl>
					{order.status !== 'rejected' &&
						(!order.paidAt || order.renewalRequestedAt) && (
							<Alert className="gap-3">
								<AlertTitle>Waiting for payment confirmation</AlertTitle>
								<AlertDescription>
									<p>
										Pay for one month of {AD_PLANS[order.plan].name} on Ko-fi.
										Use the contact email above and include your order reference
										in the message so we can match your payment.
									</p>
									<p>
										Already paid? Wait for our team to confirm receipt by email;
										do not pay again. Opening Ko-fi does not update your payment
										status.{' '}
										{order.paidAt
											? 'Your campaign dates extend after the team confirms this renewal payment.'
											: 'Your first advertising month starts after materials are approved.'}
									</p>
								</AlertDescription>
								<a
									href={AD_PLANS[order.plan].paymentUrl}
									target="_blank"
									rel="noopener noreferrer"
									referrerPolicy="no-referrer"
									className={buttonVariants({
										className: 'min-h-11 justify-self-start',
									})}
								>
									Pay {AD_PLANS[order.plan].name} on Ko-fi
									<span className="sr-only"> (opens in a new tab)</span>
								</a>
							</Alert>
						)}
					{order.feedback && (
						<Alert>
							<AlertTitle>Review feedback</AlertTitle>
							<AlertDescription>{order.feedback}</AlertDescription>
						</Alert>
					)}
					{order.status === 'rejected' && (
						<p>
							Your first campaign was declined. Reply to your order email to
							arrange a manual refund with the team.
						</p>
					)}
					{order.status === 'in_review' && (
						<p className="text-muted-foreground">
							Your materials are waiting for review. Previously approved artwork
							remains live during the review.
						</p>
					)}
					{order.paidAt && order.status !== 'rejected' && (
						<>
							{!editing && (
								<Button className="self-start" onClick={() => setEditing(true)}>
									{order.material
										? 'Edit submitted materials'
										: 'Upload advertising materials'}
								</Button>
							)}
							{editing && (
								<AdMaterialForm
									key={`${order.id}:${order.version}`}
									access={access}
									order={order}
									onSaved={(value) => {
										setOrder(value)
										setEditing(false)
									}}
									onCancel={() => setEditing(false)}
								/>
							)}
						</>
					)}
					{order.campaignId && order.status !== 'rejected' && (
						<section
							className="flex flex-col gap-3"
							aria-labelledby="ad-renewal-title"
						>
							<h2 id="ad-renewal-title" className="text-xl font-semibold">
								Renew your campaign
							</h2>
							<p className="text-sm text-muted-foreground">
								No automatic billing. Request another month at US$
								{order.amount / 100}, then pay through Ko-fi using the link that
								appears after your request. Dates extend only after the team
								confirms the new payment. If your period has ended, a new month
								starts at confirmation.
							</p>
							<Button
								className="self-start"
								variant="outline"
								disabled={busy || !!order.renewalRequestedAt}
								onClick={async () => {
									setBusy(true)
									setError('')
									try {
										setOrder(
											await client.adBilling.requestRenewal({ body: access })
										)
									} catch {
										setError(
											'Unable to request renewal. Please refresh and try again.'
										)
									} finally {
										setBusy(false)
									}
								}}
							>
								{order.renewalRequestedAt
									? 'Renewal requested — awaiting payment'
									: busy
										? 'Requesting…'
										: 'Request one more month'}
							</Button>
						</section>
					)}
				</>
			)}
			{(!order || error) && !loading && <AdAccessRequest />}
		</article>
	)
}

function AdMaterialForm({
	access,
	order,
	onSaved,
	onCancel,
}: {
	access: AdAccess
	order: AdOrderView
	onSaved: (order: AdOrderView) => void
	onCancel: () => void
}) {
	const [body, setBody] = useState<AdCreative>(
			order.material ?? {
				name: '',
				description: '',
				websiteUrl: '',
				logo: '',
				banner: '',
			}
		),
		[saving, setSaving] = useState(false),
		[error, setError] = useState(''),
		[logoBusy, setLogoBusy] = useState(false),
		[bannerBusy, setBannerBusy] = useState(false)
	const change = (key: keyof AdCreative, value: string) =>
		setBody((old) => {
			return { ...old, [key]: value }
		})
	const bindUpload = (kind: 'logo' | 'banner'): ImageUploadEndpoints => {
		return {
			request: (input) =>
				client.adBilling.upload[kind].request({
					body: { ...input.body, ...access },
				}),
			remove: (input) =>
				client.adBilling.upload[kind].remove({
					body: { ...input.body, ...access },
				}),
			change: (input) =>
				client.adBilling.upload[kind].change({
					body: { ...input.body, ...access },
				}),
		}
	}
	return (
		<form
			onSubmit={async (event) => {
				event.preventDefault()
				setError('')
				const parsed = adCreativeSchema.safeParse({
					...body,
					banner: order.plan === 'core' ? body.logo : body.banner,
				})
				if (!parsed.success) {
					setError(
						parsed.error.issues
							.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
							.join('; ')
					)
					return
				}
				setSaving(true)
				try {
					onSaved(
						await client.adBilling.submit({
							body: {
								...access,
								material: parsed.data,
								expectedVersion: order.version,
							},
						})
					)
				} catch {
					setError(
						'Unable to submit. Check uploads, or refresh the order if another change was made. Your input is retained.'
					)
				} finally {
					setSaving(false)
				}
			}}
		>
			<FieldGroup>
				{(['name', 'description', 'websiteUrl'] as const).map((key) => (
					<Field key={key}>
						<FieldLabel htmlFor={`material-${key}`}>
							{
								{
									name: 'Advertiser name',
									description: 'Short description',
									websiteUrl: 'Website URL',
								}[key]
							}
						</FieldLabel>
						<Input
							id={`material-${key}`}
							required
							type={key === 'websiteUrl' ? 'url' : 'text'}
							maxLength={{ name: 80, description: 180, websiteUrl: 2048 }[key]}
							value={body[key]}
							onChange={(event) => change(key, event.target.value)}
						/>
					</Field>
				))}
				<Field>
					<FieldLabel>Logo</FieldLabel>
					<LogoUploader
						api={bindUpload('logo')}
						value={body.logo.startsWith('tmp/') ? body.logo : undefined}
						existingUrl={
							body.logo.startsWith('ads/')
								? resolveFileUrl(body.logo)
								: undefined
						}
						onChange={(value) => change('logo', value)}
						onRemoveExisting={() => change('logo', '')}
						onBusyChange={setLogoBusy}
					/>
				</Field>
				{order.plan !== 'core' && (
					<Field>
						<FieldLabel>Sponsor grid artwork</FieldLabel>
						<FieldDescription>
							Horizontal brand wordmark, 3:1 ratio. PNG, JPG, WebP or GIF up to
							5 MB.
						</FieldDescription>
						<ImageUploader
							api={bindUpload('banner')}
							aspectRatio={3}
							className="aspect-[3/1]"
							accept={{ 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'] }}
							mimeTypes={SCREENSHOT_MIME}
							maxSize={SCREENSHOT_MAX_SIZE}
							value={body.banner.startsWith('tmp/') ? body.banner : undefined}
							existingUrl={
								body.banner.startsWith('ads/')
									? resolveFileUrl(body.banner)
									: undefined
							}
							onChange={(value) => change('banner', value)}
							onRemoveExisting={() => change('banner', '')}
							onBusyChange={setBannerBusy}
							copy={{
								noun: 'Artwork',
								uploadingNoun: 'artwork',
								sizeHint: 'Horizontal wordmark up to 5 MB.',
								dialogTitle: 'Crop sponsor artwork',
								dialogDescription:
									'Keep your horizontal brand wordmark inside the highlighted area.',
							}}
						/>
					</Field>
				)}
				<p className="text-sm text-muted-foreground">
					The team reviews your materials and configures the call-to-action text
					and button color. Submission does not publish changes immediately.
				</p>
				{error && (
					<p role="alert" className="text-sm text-destructive">
						{error}
					</p>
				)}
				<div className="flex flex-wrap gap-3">
					<Button type="submit" disabled={saving || logoBusy || bannerBusy}>
						{saving ? 'Submitting…' : 'Submit materials for review'}
					</Button>
					<Button
						type="button"
						variant="outline"
						disabled={saving || logoBusy || bannerBusy}
						onClick={onCancel}
					>
						Cancel editing
					</Button>
				</div>
			</FieldGroup>
		</form>
	)
}
