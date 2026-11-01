import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import {
	SCREENSHOT_MAX_SIZE,
	SCREENSHOT_MIME,
} from '@altstack/shared/constants'
import { adBodySchema, campaignPeriod } from '@altstack/shared/schemas/ads'
import type { AdBody, AdCampaign } from '@altstack/shared/schemas/ads'

import { Badge } from '@altstack/ui/components/badge'
import { Button } from '@altstack/ui/components/button'
import {
	Field,
	FieldGroup,
	FieldLabel,
	FieldDescription,
} from '@altstack/ui/components/field'
import { Input } from '@altstack/ui/components/input'

import { ImageUploader, LogoUploader } from '#/components/image-uploader'
import { client, orpc } from '#/utils/orpc'
import { resolveFileUrl } from '#/utils/storage'
import { AdCard } from './components'
import { inventoryOptions } from './provider'

const blank = (): AdBody => {
	return {
		name: '',
		description: '',
		websiteUrl: '',
		logo: '',
		banner: '',
		ctaText: 'Visit website',
		buttonColor: '#2563eb',
		tier: 'tier1',
		status: 'draft',
		startMonth: new Date().toISOString().slice(0, 7),
		months: 1,
	}
}
export function AdsAdmin() {
	const query = useQuery(orpc.admin.ads.list.queryOptions({ input: {} }))
	const [editing, setEditing] = useState<AdCampaign | 'new'>()
	const [deleting, setDeleting] = useState<AdCampaign>()
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState('')
	const qc = useQueryClient()
	const refresh = async () => {
		await qc.invalidateQueries({ queryKey: orpc.admin.ads.key() })
		await qc.invalidateQueries({
			queryKey: inventoryOptions().queryKey.slice(0, 2),
		})
	}
	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-8">
			<header className="flex flex-wrap items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-semibold">Ad campaigns</h1>
					<p className="text-sm text-muted-foreground">
						Monthly campaigns, scheduled in UTC. No impression or payment
						tracking.
					</p>
				</div>
				<Button
					onClick={() => {
						setError('')
						setEditing('new')
					}}
				>
					Create campaign
				</Button>
			</header>
			{error && (
				<p role="alert" className="text-destructive">
					{error}
				</p>
			)}
			{editing ? (
				<CampaignForm
					key={editing === 'new' ? 'new' : editing.id}
					campaign={editing === 'new' ? undefined : editing}
					onCancel={() => setEditing(undefined)}
					onSaved={async () => {
						setEditing(undefined)
						await refresh()
					}}
				/>
			) : (
				<>
					{query.isPending && <output>Loading campaigns…</output>}
					{query.isError && (
						<div role="alert">
							Unable to load campaigns.{' '}
							<Button onClick={() => void query.refetch()} variant="outline">
								Retry
							</Button>
						</div>
					)}
					{query.data?.length === 0 && (
						<p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
							No campaigns yet. Create a draft to upload advertiser artwork.
						</p>
					)}
					<div className="flex flex-col gap-3">
						{query.data?.map((ad) => (
							<article
								key={ad.id}
								className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4"
							>
								<div className="flex min-w-0 flex-col gap-1">
									<h2 className="font-medium wrap-anywhere">{ad.name}</h2>
									<div className="flex flex-wrap gap-2">
										<Badge variant="outline">{ad.tier}</Badge>
										<Badge variant="secondary">{ad.status}</Badge>
									</div>
									<p className="text-sm text-muted-foreground">
										{ad.startMonth} · {ad.months} month(s) · ends{' '}
										{ad.endsAt.toISOString().slice(0, 10)} UTC (exclusive)
									</p>
								</div>
								<div className="flex gap-2">
									<Button variant="outline" onClick={() => setEditing(ad)}>
										Edit<span className="sr-only"> {ad.name}</span>
									</Button>
									<Button variant="destructive" onClick={() => setDeleting(ad)}>
										Delete<span className="sr-only"> {ad.name}</span>
									</Button>
								</div>
							</article>
						))}
					</div>
					{deleting && (
						<section
							aria-label="Confirm campaign deletion"
							className="flex flex-col gap-3 rounded-xl border p-4"
						>
							<p>
								Delete campaign “{deleting.name}” and its artwork? This cannot
								be undone.
							</p>
							<div className="flex gap-2">
								<Button
									disabled={busy}
									variant="destructive"
									onClick={async () => {
										setBusy(true)
										setError('')
										try {
											await client.admin.ads.delete({
												params: { id: deleting.id },
												body: { expectedVersion: deleting.version },
											})
											setDeleting(undefined)
											await refresh()
										} catch {
											setError(
												'Unable to delete. Reload campaigns if another admin changed this campaign.'
											)
										} finally {
											setBusy(false)
										}
									}}
								>
									{busy ? 'Deleting…' : 'Confirm delete'}
								</Button>
								<Button
									variant="outline"
									disabled={busy}
									onClick={() => setDeleting(undefined)}
								>
									Cancel
								</Button>
							</div>
						</section>
					)}
				</>
			)}
		</div>
	)
}
function CampaignForm({
	campaign,
	onCancel,
	onSaved,
}: {
	campaign?: AdCampaign
	onCancel: () => void
	onSaved: () => Promise<void>
}) {
	const [body, setBody] = useState<AdBody>(campaign ?? blank)
	const [error, setError] = useState('')
	const [saving, setSaving] = useState(false)
	const [logoBusy, setLogoBusy] = useState(false),
		[bannerBusy, setBannerBusy] = useState(false)
	const change = <K extends keyof AdBody>(key: K, value: AdBody[K]) =>
		setBody((old) => {
			return { ...old, [key]: value }
		})
	const isValid = adBodySchema.safeParse(body).success
	const preview = isValid
		? {
				...body,
				...campaignPeriod(body.startMonth, body.months),
				id: campaign?.id ?? 'preview',
				version: 1,
				createdAt: new Date(0),
				updatedAt: new Date(0),
			}
		: undefined
	return (
		<form
			className="grid gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
			onSubmit={async (event) => {
				event.preventDefault()
				setError('')
				const parsed = adBodySchema.safeParse(body)
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
					if (campaign) {
						await client.admin.ads.update({
							params: { id: campaign.id },
							body: { ...parsed.data, expectedVersion: campaign.version },
						})
					} else await client.admin.ads.create({ body: parsed.data })
					await onSaved()
				} catch {
					setError(
						'Unable to save. Check uploads and reload if another admin edited this campaign. Your input is retained.'
					)
				} finally {
					setSaving(false)
				}
			}}
		>
			<FieldGroup>
				{(['name', 'description', 'websiteUrl', 'ctaText'] as const).map(
					(key) => (
						<Field key={key}>
							<FieldLabel htmlFor={`ad-${key}`}>
								{
									{
										name: 'Advertiser name',
										description: 'Short description',
										websiteUrl: 'Website URL',
										ctaText: 'CTA text',
									}[key]
								}
							</FieldLabel>
							<Input
								id={`ad-${key}`}
								required
								type={key === 'websiteUrl' ? 'url' : 'text'}
								maxLength={
									{ name: 80, description: 180, websiteUrl: 2048, ctaText: 40 }[
										key
									]
								}
								value={body[key]}
								onChange={(event) => change(key, event.target.value)}
							/>
						</Field>
					)
				)}
				<Field>
					<FieldLabel htmlFor="ad-color">CTA button color</FieldLabel>
					<Input
						id="ad-color"
						type="color"
						value={body.buttonColor}
						onChange={(event) => change('buttonColor', event.target.value)}
					/>
					<FieldDescription>
						Choose the advertiser’s logo color. Default #2563eb; text contrast
						adjusts automatically.
					</FieldDescription>
				</Field>
				<Field>
					<FieldLabel>Logo</FieldLabel>
					<LogoUploader
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
				<Field>
					<FieldLabel>Sponsor grid artwork</FieldLabel>
					<FieldDescription>
						Horizontal brand wordmark, 3:1 ratio. PNG, JPG, WebP or GIF up to 5
						MB.
					</FieldDescription>
					<ImageUploader
						value={body.banner.startsWith('tmp/') ? body.banner : undefined}
						existingUrl={
							body.banner.startsWith('ads/')
								? resolveFileUrl(body.banner)
								: undefined
						}
						onRemoveExisting={() => change('banner', '')}
						onChange={(value) => change('banner', value)}
						onBusyChange={setBannerBusy}
						aspectRatio={3}
						maxSize={SCREENSHOT_MAX_SIZE}
						mimeTypes={SCREENSHOT_MIME}
						accept={{ 'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif'] }}
						api={client.admin.upload.screenshot}
						copy={{
							noun: 'Wordmark',
							uploadingNoun: 'wordmark',
							sizeHint: 'Horizontal artwork up to 5 MB.',
							dialogTitle: 'Crop sponsor wordmark',
							dialogDescription:
								'Keep the full brand wordmark within the highlighted area.',
						}}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="ad-tier">Tier</FieldLabel>
					<select
						id="ad-tier"
						className="min-h-11 rounded-md border bg-background px-3"
						value={body.tier}
						onChange={(event) => {
							const value = event.target.value
							if (value === 'tier1' || value === 'tier2' || value === 'tier3') {
								change('tier', value)
							}
						}}
					>
						{['tier1', 'tier2', 'tier3'].map((tier) => (
							<option key={tier}>{tier}</option>
						))}
					</select>
					<FieldDescription>
						Tier 3 has twice the selection weight. Tier 1 and 2 share base
						weight on shared placements.
					</FieldDescription>
				</Field>
				<Field>
					<FieldLabel htmlFor="ad-status">Status</FieldLabel>
					<select
						id="ad-status"
						className="min-h-11 rounded-md border bg-background px-3"
						value={body.status}
						onChange={(event) => {
							const value = event.target.value
							if (
								value === 'draft' ||
								value === 'active' ||
								value === 'inactive'
							) {
								change('status', value)
							}
						}}
					>
						{['draft', 'active', 'inactive'].map((status) => (
							<option key={status}>{status}</option>
						))}
					</select>
				</Field>
				<Field>
					<FieldLabel htmlFor="ad-month">Start month (UTC)</FieldLabel>
					<Input
						id="ad-month"
						type="month"
						min="2020-01"
						required
						value={body.startMonth}
						onChange={(event) => change('startMonth', event.target.value)}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="ad-months">
						Duration in calendar months
					</FieldLabel>
					<Input
						id="ad-months"
						type="number"
						min={1}
						max={24}
						required
						value={body.months}
						onChange={(event) => change('months', event.target.valueAsNumber)}
					/>
					<FieldDescription>
						Starts on the first day at 00:00 UTC. Ends at the start of the month
						after the chosen duration.
					</FieldDescription>
				</Field>
				{error && (
					<p role="alert" className="text-destructive">
						{error}
					</p>
				)}
				<div className="flex flex-wrap gap-2">
					<Button type="submit" disabled={saving || logoBusy || bannerBusy}>
						{saving ? 'Saving…' : 'Save campaign'}
					</Button>
					<Button
						type="button"
						variant="outline"
						disabled={saving || logoBusy || bannerBusy}
						onClick={onCancel}
					>
						Cancel
					</Button>
				</div>
			</FieldGroup>
			<aside className="flex flex-col gap-3 self-start md:sticky md:top-20">
				<h2 className="font-medium">Card preview</h2>
				{preview ? (
					<AdCard ad={preview} />
				) : (
					<p className="text-sm text-muted-foreground">
						Complete the fields and upload both images to preview.
					</p>
				)}
			</aside>
		</form>
	)
}
