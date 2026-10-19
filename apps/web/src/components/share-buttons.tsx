import {
	IconBrandFacebook,
	IconBrandLinkedin,
	IconBrandTelegram,
	IconBrandThreads,
	IconBrandWhatsapp,
	IconBrandX,
	IconBrandYcombinator,
} from '@tabler/icons-react'
import { useHydrated, useLocation } from '@tanstack/react-router'

import { Button, buttonVariants } from '@altstack/ui/components/button'
import { ButtonGroup } from '@altstack/ui/components/button-group'
import { Separator } from '@altstack/ui/components/separator'
import { toast } from '@altstack/ui/components/toast'

import { publicUrl } from '#/features/seo/meta'

export const ShareButtons = () => {
	const hydrated = useHydrated()
	const href = useLocation({ select: (location) => location.publicHref })
	// Fragments are absent on the server; include them after hydration.
	const fullUrl = publicUrl(hydrated ? href : href.replace(/#.*$/, ''))
	const encodedUrl = encodeURIComponent(fullUrl)
	const shareLinks = [
		{
			name: 'X',
			icon: IconBrandX,
			url: `https://x.com/intent/post?url=${encodedUrl}`,
		},
		{
			name: 'Threads',
			icon: IconBrandThreads,
			url: `https://www.threads.com/intent/post?text=${encodedUrl}`,
		},
		{
			name: 'Facebook',
			icon: IconBrandFacebook,
			url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
		},
		{
			name: 'LinkedIn',
			icon: IconBrandLinkedin,
			url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
		},
		{
			name: 'Hacker News',
			icon: IconBrandYcombinator,
			url: `https://news.ycombinator.com/submitlink?u=${encodedUrl}`,
		},
		{
			name: 'Telegram',
			icon: IconBrandTelegram,
			url: `https://t.me/share/url?url=${encodedUrl}`,
		},
		{
			name: 'WhatsApp',
			icon: IconBrandWhatsapp,
			url: `https://api.whatsapp.com/send?text=${encodedUrl}`,
		},
	]

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(fullUrl)
			toast.add({ type: 'success', title: 'Link copied to clipboard' })
		} catch {
			toast.add({
				type: 'error',
				title: 'Unable to copy link',
				description: "Copy the URL from your browser's address bar.",
			})
		}
	}

	return (
		<div className="sticky bottom-2 z-20 flex w-fit max-w-full flex-wrap items-center gap-1 rounded-sm border bg-background/95 p-1 backdrop-blur-sm">
			<Button type="button" size="sm" variant="ghost" onClick={copyLink}>
				Copy Link
			</Button>

			<Separator orientation="vertical" className="hidden sm:block" />

			<ButtonGroup aria-label="Share on social media" className="flex-wrap">
				{shareLinks.map(({ name, icon: Icon, url }) => (
					<a
						key={name}
						href={url}
						target="_blank"
						rel="noopener noreferrer"
						aria-label={`Share on ${name} (opens in a new tab)`}
						title={`Share on ${name}`}
						className={buttonVariants({ size: 'icon-sm', variant: 'ghost' })}
					>
						<Icon aria-hidden="true" />
					</a>
				))}
			</ButtonGroup>
		</div>
	)
}
