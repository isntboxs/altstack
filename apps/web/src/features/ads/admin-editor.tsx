import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { ReactNode } from 'react'

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
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from '@altstack/ui/components/tabs'

import { ImageUploader, LogoUploader } from '#/components/image-uploader'
import { client, orpc } from '#/utils/orpc'
import { resolveFileUrl } from '#/utils/storage'
import { AdCard } from './components'
import { inventoryOptions } from './provider'

const tierLabels = { tier1: 'Core', tier2: 'Plus', tier3: 'Priority' } as const
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
export function AdsAdmin({
	children,
	managedCampaignIds = [],
	onManageOrder,
}: {
	children?: ReactNode
	managedCampaignIds?: Array<string>
	onManageOrder?: (campaignId: string) => void
} = {}) {
	const managedIds = new Set(managedCampaignIds)
	const query = useQuery(orpc.admin.ads.list.queryOptions({ input: {} }))
	const [editing, setEditing] = useState<AdCampaign | 'new'>()
	const [deleting, setDeleting] = useState<AdCampaign>()
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState('')
	const [section, setSection] = useState(children ? 'orders' : 'campaigns')
	const qc = useQueryClient()
	const refresh = async () => {
		await qc.invalidateQueries({ queryKey: orpc.admin.ads.key() })
		await qc.invalidateQueries({
			queryKey: inventoryOptions().queryKey.slice(0, 2),
		})
	}
	return (
		<div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-7 p-4 sm:p-6 lg:p-8">
			<header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex flex-col gap-1.5">
					<h1 className="text-2xl font-semibold tracking-tight">Advertising</h1>
					<p className="max-w-xl text-sm text-muted-foreground">
						Manage advertiser orders, confirm payments, and publish campaigns.
					</p>
				</div>
				<Button
					variant={children && section === 'orders' ? 'outline' : 'default'}
					className="self-start"
					onClick={() => {
						setError('')
						setSection('campaigns')
						setEditing('new')
					}}
				>
					Create campaign
				</Button>
			</header>
			<Tabs
				value={section}
				onValueChange={setSection}
				className="min-w-0 gap-6"
			>
				{children && (
					<TabsList
						variant="line"
						className="w-full justify-start border-b group-data-horizontal/tabs:h-9"
					>
						<TabsTrigger value="orders" className="flex-none px-4">
							Orders
						</TabsTrigger>
						<TabsTrigger value="campaigns" className="flex-none px-4">
							Campaigns{query.data ? ` (${query.data.length})` : ''}
						</TabsTrigger>
					</TabsList>
				)}
				<TabsContent value="orders" keepMounted>
					{children}
				</TabsContent>
				<TabsContent
					value="campaigns"
					keepMounted
					className="flex min-w-0 flex-col gap-5"
				>
					<div className="flex flex-col gap-1">
						<h2 className="text-lg font-semibold">
							{editing
								? editing === 'new'
									? 'New direct campaign'
									: 'Edit campaign'
								: 'Campaign inventory'}
						</h2>
						<p className="text-sm text-muted-foreground">
							{editing
								? 'Configure artwork, placements, and schedule. Advertiser purchases are managed in Orders.'
								: 'Published, paused, and draft campaigns. All dates use UTC.'}
						</p>
					</div>
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
									<Button
										onClick={() => void query.refetch()}
										variant="outline"
									>
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
										className="flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
									>
										<div className="flex min-w-0 flex-col gap-1">
											<h3 className="font-medium wrap-anywhere">{ad.name}</h3>
											<div className="flex flex-wrap gap-2">
												<Badge variant="outline">{tierLabels[ad.tier]}</Badge>
												<Badge variant="secondary">{ad.status}</Badge>
											</div>
											<p className="text-sm text-muted-foreground">
												{ad.startsAt.toISOString().slice(0, 10)} –{' '}
												{ad.endsAt.toISOString().slice(0, 10)} UTC
											</p>
										</div>
										<div className="flex gap-2">
											{managedIds.has(ad.id) ? (
												<Button
													variant="outline"
													onClick={() => {
														setSection('orders')
														onManageOrder?.(ad.id)
														requestAnimationFrame(() => {
															const order = document.getElementById(
																`order-${ad.id}`
															)
															order?.scrollIntoView({ block: 'start' })
															order
																?.querySelector<HTMLButtonElement>(
																	'button[aria-expanded]'
																)
																?.focus({ preventScroll: true })
														})
													}}
												>
													Manage order
												</Button>
											) : (
												<Button
													variant="outline"
													onClick={() => setEditing(ad)}
												>
													Edit<span className="sr-only"> {ad.name}</span>
												</Button>
											)}
											{!managedIds.has(ad.id) && (
												<Button
													variant="destructive"
													onClick={() => setDeleting(ad)}
												>
													Delete<span className="sr-only"> {ad.name}</span>
												</Button>
											)}
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
										Delete campaign “{deleting.name}” and its artwork? This
										cannot be undone.
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
				</TabsContent>
			</Tabs>
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
			className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]"
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
			<div className="flex min-w-0 flex-col gap-6">
				<fieldset className="min-w-0 rounded-xl border p-4 sm:p-5">
					<legend className="px-2 text-sm font-semibold">
						Advertiser details
					</legend>
					<FieldGroup className="grid items-start gap-5 sm:grid-cols-2">
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
											{
												name: 80,
												description: 180,
												websiteUrl: 2048,
												ctaText: 40,
											}[key]
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
								Choose the advertiser’s logo color. Default #2563eb; text
								contrast adjusts automatically.
							</FieldDescription>
						</Field>
					</FieldGroup>
				</fieldset>
				<fieldset className="min-w-0 rounded-xl border p-4 sm:p-5">
					<legend className="px-2 text-sm font-semibold">Brand artwork</legend>
					<FieldGroup className="grid items-start gap-5 sm:grid-cols-2">
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
								Horizontal brand wordmark, 3:1 ratio. PNG, JPG, WebP or GIF up
								to 5 MB.
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
								accept={{
									'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif'],
								}}
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
					</FieldGroup>
				</fieldset>
				<fieldset className="min-w-0 rounded-xl border p-4 sm:p-5">
					<legend className="px-2 text-sm font-semibold">
						Placements & schedule
					</legend>
					<FieldGroup className="grid items-start gap-5 sm:grid-cols-2">
						<Field>
							<FieldLabel htmlFor="ad-tier">Tier</FieldLabel>
							<select
								id="ad-tier"
								className="h-8 rounded-md border bg-background px-3"
								value={body.tier}
								onChange={(event) => {
									const value = event.target.value
									if (
										value === 'tier1' ||
										value === 'tier2' ||
										value === 'tier3'
									) {
										change('tier', value)
									}
								}}
							>
								{Object.entries(tierLabels).map(([tier, label]) => (
									<option key={tier} value={tier}>
										{label}
									</option>
								))}
							</select>
							<FieldDescription>
								Priority has twice the selection weight of Plus in shared
								rotation.
							</FieldDescription>
						</Field>
						<Field>
							<FieldLabel htmlFor="ad-status">Status</FieldLabel>
							<select
								id="ad-status"
								className="h-8 rounded-md border bg-background px-3"
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
								onChange={(event) =>
									change('months', event.target.valueAsNumber)
								}
							/>
							<FieldDescription>
								Starts on the first day at 00:00 UTC. Ends at the start of the
								month after the chosen duration.
							</FieldDescription>
						</Field>
					</FieldGroup>
				</fieldset>
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
			</div>
			<aside className="flex min-w-0 flex-col gap-3 rounded-xl border bg-muted/20 p-4 xl:sticky xl:top-4">
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
