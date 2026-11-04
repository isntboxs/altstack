import type { AboutBody } from '@altstack/shared/schemas'

import { PublicContent } from '#/components/public-content'

export function AboutArticle({ page }: { page: AboutBody }) {
	return (
		<div className="container mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pt-28 pb-10 lg:px-16">
			<header className="flex max-w-3xl flex-col gap-4">
				<h1 className="text-3xl font-medium tracking-tight wrap-anywhere sm:text-4xl">
					{page.title}
				</h1>
				<p className="text-lg leading-7 text-pretty wrap-anywhere text-muted-foreground">
					{page.description}
				</p>
			</header>
			<div className="w-full max-w-3xl min-w-0">
				<PublicContent
					slug="about"
					content={page.content}
					headingMode="article"
				/>
			</div>
		</div>
	)
}
