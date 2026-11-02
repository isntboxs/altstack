import type { PageLedger } from './selection'
import {
	IconArrowUpRight,
	IconMinus,
	IconPlayerPause,
	IconPlayerPlay,
} from '@tabler/icons-react'
import { cn } from 'cn'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { ctaForeground } from '@altstack/shared/schemas/ads'
import type { AdCampaign } from '@altstack/shared/schemas/ads'

import { Badge } from '@altstack/ui/components/badge'
import { Button } from '@altstack/ui/components/button'
import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
	CardFooter,
} from '@altstack/ui/components/card'
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from '@altstack/ui/components/tooltip'

import { ProjectLogo } from '#/components/project-media'
import { resolveFileUrl } from '#/utils/storage'
import { useAds, useAdsEntry } from './context'
import {
	CORNER_INTERVAL,
	ledgerKey,
	listingSlots,
	readSession,
	recordPage,
	sessionStore,
	weightedAds,
} from './selection'
import { useHiddenAds } from './use-hidden-ads'

const external = {
	target: '_blank',
	rel: 'sponsored noopener noreferrer',
} as const
export function AdCard({ ad }: { ad: AdCampaign }) {
	return (
		<article
			className="ad-card relative min-w-0 rounded-xl border p-0.5"
			aria-label={`Advertisement: ${ad.name}`}
		>
			<Badge
				variant="outline"
				className="absolute -top-2.5 left-4 z-10 rounded-sm bg-background py-2.5 leading-none font-normal text-muted-foreground"
			>
				Ad
			</Badge>
			<a {...external} href={ad.websiteUrl}>
				<Card className="relative h-full overflow-hidden ring-0">
					<div
						aria-hidden="true"
						className="pointer-events-none absolute -top-6 -right-8 rotate-12 opacity-[0.06]"
					>
						<ProjectLogo src={ad.logo} name={ad.name} className="size-40" />
					</div>
					<CardHeader>
						<CardTitle className="flex min-w-0 items-center gap-2">
							<ProjectLogo src={ad.logo} name={ad.name} className="size-8" />
							<span className="min-w-0 wrap-anywhere">{ad.name}</span>
						</CardTitle>
					</CardHeader>
					<CardContent className="relative flex-1">
						<CardDescription className="wrap-anywhere">
							{ad.description}
						</CardDescription>
					</CardContent>
					<CardFooter className="relative border-0 bg-transparent">
						<div
							style={{
								backgroundColor: ad.buttonColor,
								color: ctaForeground(ad.buttonColor),
							}}
							className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-medium hover:brightness-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
						>
							<span className="wrap-anywhere">{ad.ctaText}</span>
							<IconArrowUpRight
								className="size-4 shrink-0"
								aria-hidden="true"
							/>
							<span className="sr-only"> (opens in a new tab)</span>
						</div>
					</CardFooter>
				</Card>
			</a>
		</article>
	)
}
export function AdBanner() {
	const ad = useAds('banner').at(0)
	if (!ad) return null
	return (
		<aside
			className="ad-banner z-40 container mx-auto mt-14 -mb-14 w-full max-w-6xl px-4 lg:px-16"
			aria-label="Advertisement"
		>
			<a
				{...external}
				href={ad.websiteUrl}
				className="group relative block rounded-md border border-border p-1 transition-all duration-300 ease-in-out hover:border-foreground/20"
			>
				<div className="absolute inset-0 -z-1 rounded-md bg-background" />
				<span className="mx-auto flex max-w-6xl items-start gap-4 rounded-md bg-muted/30 px-3 py-2 text-xs group-hover:bg-muted/50 sm:items-center sm:text-sm">
					<Badge
						variant="outline"
						className="rounded-sm px-1.5 py-1 text-[11px] leading-none font-normal text-muted-foreground"
					>
						Ad
					</Badge>
					<ProjectLogo
						src={ad.logo}
						name={ad.name}
						className="-mr-2 size-4.5"
					/>
					<span className="min-w-0 flex-1 wrap-anywhere">
						<strong>{ad.name}</strong>
						<span className="text-muted-foreground"> - {ad.description}</span>
					</span>
					<span className="hidden shrink-0 rounded-md border border-border bg-background px-2 py-1 text-xs leading-none font-normal text-muted-foreground sm:block">
						Learn more
					</span>
					<span className="sr-only"> (opens in a new tab)</span>
				</span>
			</a>
		</aside>
	)
}
export function SponsorGrid() {
	const ads = useAds('sponsors')
	if (ads.length === 0) return null
	// One cell per advertiser, keeping the server's stable creation order.
	const unique = ads.filter(
		(ad, i) =>
			ads.findIndex(
				(other) =>
					new URL(other.websiteUrl).hostname.replace(/^www\./, '') ===
					new URL(ad.websiteUrl).hostname.replace(/^www\./, '')
			) === i
	)
	return (
		<section
			className="ad-sponsors container mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 lg:px-16"
			aria-label="AltStack sponsors"
		>
			<p className="text-center text-sm text-muted-foreground">
				These sponsors support AltStack.{' '}
				<a href="/advertise" className="underline underline-offset-4">
					Advertise with us
				</a>
			</p>
			<div className="grid grid-cols-2 border-t border-l sm:grid-cols-3 lg:grid-cols-6">
				{unique.map((ad) => (
					<Tooltip key={ad.id}>
						<TooltipTrigger
							render={
								<div className="group relative min-w-0 border-r border-b">
									<a
										{...external}
										href={ad.websiteUrl}
										aria-label={`Visit ${ad.name} (opens in a new tab)`}
										aria-describedby={`sponsor-${ad.id}`}
										className="flex min-h-20 items-center justify-center p-4 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring"
									>
										<img
											src={resolveFileUrl(ad.banner)}
											width={240}
											height={80}
											alt={ad.name}
											className="h-10 w-full object-contain"
										/>
									</a>
									<span id={`sponsor-${ad.id}`} className="sr-only">
										{ad.description}
									</span>
									<details className="absolute right-0 bottom-0 text-xs">
										<summary className="flex size-8 cursor-pointer list-none items-center justify-center rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
											<span aria-hidden="true">ⓘ</span>
											<span className="sr-only">About {ad.name}</span>
										</summary>
										<p className="absolute top-full right-0 z-10 w-40 rounded-md border bg-background p-3 wrap-anywhere text-foreground">
											{ad.description}
										</p>
									</details>
								</div>
							}
						/>
						<TooltipContent
							sideOffset={10}
							side="bottom"
							className="border border-border bg-background text-foreground"
							arrowClassName="border-t border-l border-border bg-background fill-background"
						>
							{ad.description}
						</TooltipContent>
					</Tooltip>
				))}
				{Array.from({ length: (6 - (unique.length % 6)) % 6 }, (_, index) => (
					<div
						key={`empty-${index}`}
						aria-hidden="true"
						className={cn(
							'min-h-20 min-w-0 border-r border-b',
							index < (2 - (unique.length % 2)) % 2 ? 'block' : 'hidden',
							index < (3 - (unique.length % 3)) % 3 ? 'sm:block' : 'sm:hidden',
							'lg:block'
						)}
					/>
				))}
			</div>
		</section>
	)
}
export function DetailAd({
	kind,
}: {
	kind: 'project-detail' | 'collection-detail'
}) {
	const ad = useAds(kind).at(0)
	return ad ? (
		<div className="ad-sidebar shrink-0">
			<AdCard ad={ad} />
		</div>
	) : null
}

export function AdListingGrid<T extends { id: string }>({
	items,
	renderItem,
	catalogue,
	page,
	offset,
	onConsumed,
}: {
	items: Array<T>
	renderItem: (item: T) => ReactNode
	catalogue: string
	page: number
	offset: number
	onConsumed?: (count: number) => void
}) {
	const selected = useAds('listing')
	const entry = useAdsEntry()
	const root = useRef<HTMLDivElement>(null)
	const hidden = useHiddenAds(root, selected.map((ad) => ad.id).join())
	const [mobile, setMobile] = useState(false)
	useEffect(() => {
		const media = matchMedia('(max-width: 767px)')
		const update = () => setMobile(media.matches)
		update()
		media.addEventListener('change', update)
		return () => media.removeEventListener('change', update)
	}, [])
	const ads = selected.filter((ad) => !hidden.includes(ad.id))
	const slots = listingSlots(items, ads, mobile)
	const consumed = slots.filter((slot) => 'item' in slot).length
	useEffect(() => {
		onConsumed?.(consumed)
		if (!entry) return
		const key = ledgerKey(catalogue)
		const ledger = readSession<PageLedger>(key, {})
		sessionStore().setItem(
			key,
			JSON.stringify(recordPage(ledger, page, offset, consumed))
		)
	}, [catalogue, page, offset, consumed, entry, onConsumed])
	return (
		<div
			ref={root}
			className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
		>
			{slots.map((slot) =>
				'ad' in slot ? (
					<div
						className="ad-listing min-w-0"
						data-ad-id={slot.ad.id}
						key={`ad-${slot.ad.id}`}
					>
						<AdCard ad={slot.ad} />
					</div>
				) : (
					<div className="contents" key={slot.item.id}>
						{renderItem(slot.item)}
					</div>
				)
			)}
		</div>
	)
}

export function CornerAd() {
	const ads = useAds('corner')
	const [current, setCurrent] = useState<string>()
	const [dismissed, setDismissed] = useState(() =>
		readSession('altstack:ads:corner-dismissed', false)
	)
	const [hover, setHover] = useState(false)
	const [focus, setFocus] = useState(false)
	const [paused, setPaused] = useState(false)
	const [hidden, setHidden] = useState(false)
	const [leaving, setLeaving] = useState(false)
	const [cycle, setCycle] = useState(0)
	const corner = useRef<HTMLElement>(null)
	const [height, setHeight] = useState(180)
	useEffect(() => {
		const visibility = () => setHidden(document.hidden)
		visibility()
		document.addEventListener('visibilitychange', visibility)
		return () => document.removeEventListener('visibilitychange', visibility)
	}, [])
	const ids = ads.map((ad) => `${ad.id}:${ad.tier}`).join()
	useEffect(() => {
		if (ads.some((ad) => ad.id === current)) return
		const timer = setTimeout(() => setCurrent(weightedAds(ads, 1)[0]?.id), 0)
		return () => clearTimeout(timer)
	}, [ids, current]) // eslint-disable-line react-hooks/exhaustive-deps
	useEffect(() => {
		const element = corner.current
		if (!element) return
		const enter = () => setHover(true),
			leave = () => setHover(false),
			focusIn = () => setFocus(true)
		const focusOut = (event: FocusEvent) => {
			if (!element.contains(event.relatedTarget as Node | null)) setFocus(false)
		}
		element.addEventListener('mouseenter', enter)
		element.addEventListener('mouseleave', leave)
		element.addEventListener('focus', focusIn, true)
		element.addEventListener('blur', focusOut, true)
		const observer =
			typeof ResizeObserver === 'undefined'
				? undefined
				: new ResizeObserver(() =>
						setHeight(element.getBoundingClientRect().height + 24)
					)
		observer?.observe(element)
		return () => {
			element.removeEventListener('mouseenter', enter)
			element.removeEventListener('mouseleave', leave)
			element.removeEventListener('focus', focusIn, true)
			element.removeEventListener('blur', focusOut, true)
			observer?.disconnect()
		}
	}, [current, cycle])
	const pool = useRef(ads)
	useEffect(() => {
		pool.current = ads
	}, [ads])
	useEffect(() => {
		if (dismissed || hover || focus || paused || hidden || !current) {
			return
		}
		const timer = setTimeout(() => setLeaving(true), CORNER_INTERVAL - 200)
		const swap = setTimeout(() => {
			setCurrent(weightedAds(pool.current, 1)[0]?.id)
			setLeaving(false)
			setCycle((value) => value + 1)
		}, CORNER_INTERVAL)
		return () => {
			clearTimeout(timer)
			clearTimeout(swap)
		}
	}, [current, cycle, dismissed, hover, focus, paused, hidden])
	const ad = ads.find((item) => item.id === current)
	if (!ad || dismissed) return null
	return (
		<>
			<div aria-hidden="true" className="sm:hidden" style={{ height }} />
			<aside
				ref={corner}
				key={cycle}
				aria-label="Sponsored recommendation"
				className={cn(
					'ad-corner group fixed inset-x-3 bottom-[max(.75rem,env(safe-area-inset-bottom))] z-40 rounded-md border bg-background px-1 pt-1 pb-[max(.25rem,env(safe-area-inset-bottom))] shadow-md sm:left-auto sm:w-66',
					leaving &&
						!hover &&
						!focus &&
						!paused &&
						!hidden &&
						'ad-corner-leaving'
				)}
			>
				<Badge
					variant="outline"
					className="absolute -top-2.5 right-4 rounded-sm bg-background px-1.5 py-1 text-[11px] leading-none font-normal text-muted-foreground"
				>
					Ad
				</Badge>
				<div className="absolute top-2 right-2 flex sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
					<Button
						size="icon-sm"
						// className="min-h-4 min-w-4"
						variant="ghost"
						aria-label={paused ? 'Resume ad rotation' : 'Pause ad rotation'}
						onClick={() => setPaused((value) => !value)}
					>
						{paused ? <IconPlayerPlay /> : <IconPlayerPause />}
					</Button>
					<Button
						size="icon-sm"
						// className="min-h-4 min-w-4"
						variant="ghost"
						aria-label="Hide ads for this session"
						onClick={() => {
							sessionStore().setItem('altstack:ads:corner-dismissed', 'true')
							setDismissed(true)
						}}
					>
						<IconMinus />
					</Button>
				</div>
				<a
					{...external}
					key={ad.id}
					href={ad.websiteUrl}
					className="flex min-w-0 flex-col gap-2 rounded-md bg-card p-4 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring"
				>
					<span className="flex min-w-0 items-center gap-2 pr-22">
						<ProjectLogo src={ad.logo} name={ad.name} className="size-5" />
						<strong className="text-xs wrap-anywhere">{ad.name}</strong>
					</span>
					<span className="text-xs wrap-anywhere text-muted-foreground">
						{ad.description}
					</span>
					<span className="sr-only"> (opens in a new tab)</span>
				</a>
			</aside>
		</>
	)
}
