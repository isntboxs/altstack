import { createFileRoute, Link } from '@tanstack/react-router'

import { seoHead } from '#/features/seo/meta'

export const Route = createFileRoute('/_app/advertise_/terms')({
	head: () =>
		seoHead({
			title: 'Advertising terms | AltStack',
			description:
				'Payment, review, monthly periods, and renewal for AltStack advertising.',
			path: '/advertise/terms',
		}),
	component: () => (
		<article className="container mx-auto flex max-w-3xl flex-col gap-5 px-4 pt-28 pb-16">
			<h1 className="text-3xl font-semibold">Advertising terms</h1>
			<p>
				Core is US$15, Plus is US$29, and Priority is US$55 for one month.
				Prices are quoted in USD. Payment method, any currency conversion, and
				the final payable amount are agreed by email before you pay. Submitting
				an order does not charge you.
			</p>
			<h2 className="text-xl font-semibold">Payment and approval</h2>
			<p>
				The team confirms receipt of payment manually. After confirmation,
				submit your name, logo, description, website, and sponsor artwork where
				required. Campaigns go live only after the team approves the materials.
				We may request changes or decline unsuitable advertising. If your first
				campaign is declined after payment, contact the team to arrange a manual
				refund; the site does not issue automated refunds.
			</p>
			<h2 className="text-xl font-semibold">Your paid month</h2>
			<p>
				The first period begins at approval and ends at the same UTC time on the
				same day of the next month, clamped to its last day when needed. Review
				time before the first approval does not reduce your paid period.
			</p>
			<h2 className="text-xl font-semibold">Renewal and revisions</h2>
			<p>
				There is no automatic renewal or recurring charge. Request a renewal
				from your private management page and arrange a new payment by email. A
				confirmed renewal adds one month from your current expiry, or from the
				confirmation time if the campaign has already expired. Material
				revisions do not reset or extend your dates. Previously approved artwork
				remains in place while a revision is reviewed.
			</p>
			<h2 className="text-xl font-semibold">Placements and selection</h2>
			<p>
				Advertisements are labeled Ad and share available placements with
				eligible campaigns. Priority has twice the selection weight of Plus,
				with the same rotation intervals. Selection does not guarantee a number
				of appearances, impressions, clicks, or conversions. Ad blockers are
				respected. Contact the team by replying to your order email for campaign
				or payment questions.
			</p>
			<Link to="/advertise" className="underline underline-offset-4">
				Back to advertising packages
			</Link>
		</article>
	),
})
