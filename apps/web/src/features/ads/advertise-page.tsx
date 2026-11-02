import { IconCheck } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { cn } from 'cn'
import { useState } from 'react'

import { AD_PLANS, adPlanSchema } from '@altstack/shared/schemas/ad-billing'
import type { AdPlan } from '@altstack/shared/schemas/ad-billing'

import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from '@altstack/ui/components/accordion'
import { Badge } from '@altstack/ui/components/badge'
import { Button } from '@altstack/ui/components/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@altstack/ui/components/card'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from '@altstack/ui/components/dialog'

import { orpc } from '#/utils/orpc'
import { AdAccessRequest } from './order-access'
import { AdOrderDialog } from './order-dialog'
import { PlacementPreview } from './placement-preview'

const packageDetails = {
	core: {
		description:
			'A presence in the catalogue, collection sidebars, and the corner of every public page.',
		features: [
			'Cards in project and collection listings',
			'Collection detail sidebar',
			'Corner ad on public pages',
		],
	},
	plus: {
		description:
			'Bring your brand to every placement, from the top banner to the homepage sponsor grid.',
		features: [
			'Everything in Core',
			'Banner on all public pages',
			'Project detail sidebar',
			'Homepage sponsor grid',
		],
	},
	priority: {
		description:
			'Every Plus placement, with more weight when an advertiser is selected for shared rotation.',
		features: [
			'Everything in Plus',
			'2× the selection weight of Plus',
			'Same rotation intervals',
		],
	},
} as const
const placements = [
	{
		kind: 'cards',
		title: 'In-list & sidebar ads',
		tiers: 'All packages',
		description:
			'Ad cards in project and collection listings, plus collection sidebars. Plus and Priority also include project detail sidebars.',
	},
	{
		kind: 'corner',
		title: 'Corner ad',
		tiers: 'All packages',
		description:
			'A compact recommendation in the bottom corner on desktop, or along the bottom on mobile. Visitors can pause or hide it.',
	},
	{
		kind: 'banner',
		title: 'Banner',
		tiers: 'Plus & Priority',
		description:
			'Your logo, name, and a short introduction just below the header on public pages. The whole banner links to your website.',
	},
	{
		kind: 'sponsors',
		title: 'Sponsor grid',
		tiers: 'Plus & Priority',
		description:
			'Your horizontal brand artwork on the homepage, between the hero and catalogue. Every eligible sponsor appears in the grid.',
	},
] as const
const questions = [
	{
		question: 'How does ad rotation work?',
		answer:
			'Banner and sidebar selections stay for at least three minutes, then can change on the next navigation or reload. Listing ads follow the same window and can change on pagination. The corner ad rotates every 15 seconds, pausing on hover, keyboard focus, or when the tab is hidden.',
	},
	{
		question: 'What makes Priority different from Plus?',
		answer:
			'Priority includes the same placements as Plus, with twice the selection weight in shared rotation. It does not rotate at shorter intervals or guarantee twice as many appearances. When all eligible advertisers fit in the available slots, they can all appear.',
	},
	{
		question: 'How many impressions or clicks will I get?',
		answer:
			'AltStack is still growing, so we do not promise a fixed number of impressions, clicks, or conversions. Launch pricing reflects that. Ad selection is not an impression count, and visitors’ ad blockers are respected.',
	},
	{
		question: 'What do I need to provide?',
		answer:
			'Your brand name, square logo, short description, and website link. Plus and Priority also need horizontal brand artwork for the sponsor grid. The team reviews the materials and configures your call-to-action text and button color.',
	},
	{
		question: 'When does my ad go live?',
		answer:
			'After the team confirms your payment and approves your materials. Your first paid month starts at approval, so the initial review does not use up your campaign time. Dates use UTC and run to the same day and time in the next month, or its last day if that date does not exist.',
	},
	{
		question: 'How do payment and renewal work?',
		answer:
			'Choose a package and enter your email. We send a private order link and coordinate payment with you by email. No account, card on file, or automatic renewal is required. To renew, request another month from your private page and arrange a new payment.',
	},
	{
		question: 'Can I update my ad after it goes live?',
		answer:
			'Yes. Open your private management link and submit revised materials. Your previously approved artwork stays in place during review. A revision does not reset or extend your paid period. If you lose your link, use “Manage your order” to request a fresh one.',
	},
	{
		question: 'What if my first campaign is declined?',
		answer:
			'We may request changes or decline unsuitable advertising. If your first campaign is declined after payment, reply to your order email to arrange a manual refund with the team. The site does not issue automatic refunds.',
	},
] as const

export function AdvertisePage() {
	const config = useQuery(orpc.adBilling.config.queryOptions({ input: {} }))
	const [plan, setPlan] = useState<AdPlan | null>(null),
		[accessOpen, setAccessOpen] = useState(false)
	return (
		<article className="container mx-auto flex max-w-6xl flex-col gap-16 px-4 pt-28 pb-20 sm:gap-24 sm:pt-32 lg:px-16">
			<section
				aria-labelledby="advertise-title"
				className="flex min-w-0 flex-col gap-8 sm:gap-10"
			>
				<header className="mx-auto flex max-w-2xl flex-col gap-4 text-center">
					<h1
						id="advertise-title"
						className="text-3xl font-semibold tracking-tight sm:text-4xl"
					>
						Advertise on AltStack
					</h1>
					<p className="mx-auto max-w-xl leading-relaxed text-muted-foreground">
						Put your product in front of people exploring open-source software.
						Choose where your brand appears, one month at a time.
					</p>
				</header>
				<div className="flex min-w-0 flex-col gap-4">
					<p className="text-center text-sm text-muted-foreground">
						Monthly packages. Payment by email.
					</p>
					<section
						aria-label="Monthly advertising packages"
						className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain px-1 py-1 pb-4 focus-visible:rounded-lg focus-visible:outline-2 focus-visible:outline-ring lg:grid lg:grid-cols-3 lg:overflow-visible lg:pb-1"
						data-package-cards
					>
						{adPlanSchema.options.map((key) => {
							const item = AD_PLANS[key],
								details = packageDetails[key]
							return (
								<Card
									key={key}
									className={cn(
										'h-full shrink-0 basis-[calc(100%-2.5rem)] snap-start rounded-lg border bg-muted/10 ring-0 [--card-spacing:--spacing(5)] sm:basis-80 lg:basis-auto',
										key === 'plus' && 'border-primary/40 bg-muted/25'
									)}
								>
									<CardHeader className="gap-3">
										<div className="flex items-center justify-between gap-2">
											<CardTitle>
												<h2>{item.name}</h2>
											</CardTitle>
											{key === 'plus' && (
												<Badge variant="secondary" className="rounded-sm">
													All placements
												</Badge>
											)}
										</div>
										<CardDescription className="min-h-18 leading-relaxed">
											{details.description}
										</CardDescription>
									</CardHeader>
									<CardContent className="flex flex-1 flex-col gap-6">
										<p className="flex items-baseline gap-1">
											<span className="self-start pt-1.5 text-xs font-medium">
												US$
											</span>
											<strong className="text-4xl font-semibold tracking-tight">
												{item.amount / 100}
											</strong>
											<span className="text-sm text-muted-foreground">
												/month
											</span>
										</p>
										<ul className="flex flex-col gap-3">
											{details.features.map((feature) => (
												<li
													key={feature}
													className="flex items-start gap-2.5 text-sm leading-relaxed"
												>
													<IconCheck
														aria-hidden="true"
														className="mt-0.5 size-4 shrink-0 rounded-sm bg-primary/10 p-0.5 text-foreground"
													/>
													<span>{feature}</span>
												</li>
											))}
										</ul>
									</CardContent>
									<CardFooter className="border-t-0 bg-transparent pt-5">
										<Button
											variant={key === 'plus' ? 'default' : 'outline'}
											className="min-h-11 w-full"
											disabled={!config.data?.available}
											onClick={() => setPlan(key)}
										>
											Choose {item.name}
										</Button>
									</CardFooter>
								</Card>
							)
						})}
					</section>
					<p className="text-center text-xs text-muted-foreground lg:hidden">
						Swipe to compare packages
					</p>
					{config.isPending && (
						<output className="text-center text-sm text-muted-foreground">
							Checking availability…
						</output>
					)}
					{config.isError && (
						<div
							role="alert"
							className="flex flex-wrap items-center justify-center gap-3 text-sm"
						>
							Unable to check availability.
							<Button variant="outline" onClick={() => void config.refetch()}>
								Retry
							</Button>
						</div>
					)}
					{config.data && !config.data.available && (
						<output className="text-center text-sm text-muted-foreground">
							Advertising orders are temporarily unavailable. Please check back
							later.
						</output>
					)}
					<div className="flex flex-col items-center gap-2 text-center text-sm text-muted-foreground">
						<p>Launch pricing in USD. No automatic billing.</p>
						<Button
							variant="link"
							className="min-h-11"
							onClick={() => setAccessOpen(true)}
						>
							Already advertising? Manage your order
						</Button>
					</div>
				</div>
			</section>

			<section
				aria-labelledby="placements-title"
				className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-12"
			>
				<header className="flex flex-col items-start gap-3">
					<p className="text-xs font-medium text-muted-foreground">
						Placements
					</p>
					<h2
						id="placements-title"
						className="text-2xl font-semibold tracking-tight"
					>
						Where your brand appears
					</h2>
					<p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
						Core covers catalogue cards, collection sidebars, and the corner ad.
						Plus and Priority add the banner, project sidebar, and sponsor grid.
					</p>
				</header>
				<div className="grid min-w-0 gap-x-6 gap-y-8 sm:grid-cols-2">
					{placements.map((placement) => (
						<figure
							key={placement.kind}
							className="flex min-w-0 flex-col gap-4"
						>
							<PlacementPreview kind={placement.kind} />
							<figcaption className="flex flex-col gap-2">
								<div className="flex flex-wrap items-center justify-between gap-2">
									<h3 className="text-sm font-medium">{placement.title}</h3>
									<Badge variant="outline" className="rounded-sm text-[10px]">
										{placement.tiers}
									</Badge>
								</div>
								<p className="text-sm leading-relaxed text-muted-foreground">
									{placement.description}
								</p>
							</figcaption>
						</figure>
					))}
				</div>
			</section>

			<section
				aria-labelledby="ad-faq-title"
				className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-12"
			>
				<header className="flex flex-col items-start gap-3">
					<p className="text-xs font-medium text-muted-foreground">FAQ</p>
					<h2
						id="ad-faq-title"
						className="text-2xl font-semibold tracking-tight"
					>
						A few things to know
					</h2>
					<p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
						Payment, materials, and campaign details before you choose your
						package.
					</p>
					{config.data?.contactEmail && (
						<a
							href={`mailto:${config.data.contactEmail}`}
							className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
						>
							Contact our team
						</a>
					)}
				</header>
				<Accordion className="gap-3">
					{questions.map(({ question, answer }) => (
						<AccordionItem
							key={question}
							value={question}
							className="rounded-lg border px-4"
						>
							<AccordionTrigger className="min-h-14 gap-4">
								{question}
							</AccordionTrigger>
							<AccordionContent className="pb-4 leading-relaxed text-muted-foreground">
								{answer}
							</AccordionContent>
						</AccordionItem>
					))}
				</Accordion>
			</section>

			<AdOrderDialog plan={plan} onClose={() => setPlan(null)} />
			<Dialog open={accessOpen} onOpenChange={setAccessOpen}>
				<DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
					<DialogTitle className="sr-only">Private order access</DialogTitle>
					<DialogDescription className="sr-only">
						Use the email address you ordered with to request a fresh link.
					</DialogDescription>
					<AdAccessRequest />
				</DialogContent>
			</Dialog>
		</article>
	)
}
