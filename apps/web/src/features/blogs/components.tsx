import { Link } from '@tanstack/react-router'
import { useMemo } from 'react'

import type { ORPCRouterOutputs } from '@altstack/api/routers'

import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from '@altstack/ui/components/breadcrumb'
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@altstack/ui/components/card'

import { PublicContent } from '#/components/public-content'
import { ShareButtons } from '#/components/share-buttons'
import { UserAvatar } from '#/components/user-avatar'
import { articleHeadings } from '#/features/public-content/headings'
import type { PreparedPublicContent } from '#/features/public-content/model'
import { BlogTableOfContents } from './table-of-contents'

type Blog = ORPCRouterOutputs['blog']['getBySlug']
type BlogCard = ORPCRouterOutputs['blog']['list']['posts'][number]
export const blogDescription =
	'Ideas, insights, and practical guides on software development, emerging technology, and the tools shaping how we build.'
export function blogDate(date: Date) {
	return new Intl.DateTimeFormat('en-US', {
		dateStyle: 'long',
		timeZone: 'UTC',
	}).format(date)
}

export function BlogBreadcrumb({ title }: { title?: string }) {
	return (
		<Breadcrumb>
			<BreadcrumbList>
				<BreadcrumbItem>
					<BreadcrumbLink render={<Link to="/" />}>Home</BreadcrumbLink>
				</BreadcrumbItem>
				<BreadcrumbSeparator />
				<BreadcrumbItem>
					{title ? (
						<BreadcrumbLink render={<Link to="/blogs" />}>Blogs</BreadcrumbLink>
					) : (
						<BreadcrumbPage>Blogs</BreadcrumbPage>
					)}
				</BreadcrumbItem>
				{title && (
					<>
						<BreadcrumbSeparator />
						<BreadcrumbItem className="min-w-0 wrap-anywhere">
							<BreadcrumbPage>{title}</BreadcrumbPage>
						</BreadcrumbItem>
					</>
				)}
			</BreadcrumbList>
		</Breadcrumb>
	)
}

export function BlogCards({ posts }: { posts: Array<BlogCard> }) {
	return (
		<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{posts.map((post) => (
				<article
					key={post.id}
					className="relative min-w-0 rounded-xl p-0.5 ring-1 ring-border transition-colors hover:ring-primary/50"
				>
					<Card className="h-full gap-5 overflow-hidden pt-0 ring-0">
						<img
							src={post.coverUrl}
							alt=""
							loading="lazy"
							decoding="async"
							width={960}
							height={540}
							className="aspect-video w-full object-cover"
						/>
						<CardHeader>
							<CardTitle>
								<h2 className="text-lg leading-snug font-medium wrap-anywhere">
									<Link
										to="/blogs/$slug"
										params={{ slug: post.slug }}
										className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-ring"
									>
										{post.title}
									</Link>
								</h2>
							</CardTitle>
						</CardHeader>
						<CardContent className="flex-1">
							<CardDescription className="line-clamp-3 wrap-anywhere">
								{post.description}
							</CardDescription>
						</CardContent>
						<CardFooter className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
							<time dateTime={post.publishedAt.toISOString()}>
								{blogDate(post.publishedAt)}
							</time>
							<span aria-hidden="true">·</span>
							<span>{post.readTime} min read</span>
						</CardFooter>
					</Card>
				</article>
			))}
		</div>
	)
}

export function BlogArticle({
	post,
	prepared,
}: {
	post: Blog
	prepared?: PreparedPublicContent
}) {
	const headings = useMemo(() => articleHeadings(post.content), [post.content])
	const updated = post.updatedAt.getTime() > post.publishedAt.getTime()
	return (
		<div className="container mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pt-28 pb-10 lg:px-16">
			<header className="flex min-w-0 flex-col gap-4">
				<BlogBreadcrumb title={post.title} />
				<h1 className="text-3xl font-medium tracking-tight wrap-anywhere sm:text-4xl">
					{post.title}
				</h1>
				<p className="max-w-3xl text-lg leading-7 text-muted-foreground">
					{post.description}
				</p>
				<div className="mt-2 flex items-center gap-3">
					<UserAvatar
						name={post.authorName}
						image={post.authorImage}
						size="lg"
					/>
					<div className="flex min-w-0 flex-col gap-1 text-sm text-muted-foreground">
						<p className="wrap-anywhere">
							Written by{' '}
							<span className="text-foreground">{post.authorName}</span>
						</p>
						<p className="flex flex-wrap gap-x-2 gap-y-1">
							<span>
								Published:{' '}
								<time dateTime={post.publishedAt.toISOString()}>
									{blogDate(post.publishedAt)}
								</time>
							</span>
							{updated && (
								<span>
									Updated:{' '}
									<time dateTime={post.updatedAt.toISOString()}>
										{blogDate(post.updatedAt)}
									</time>
								</span>
							)}
							<span aria-hidden="true">·</span>
							<span>{post.readTime} min read</span>
						</p>
					</div>
				</div>
			</header>
			<div className="grid min-w-0 items-stretch gap-8 lg:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)]">
				<BlogTableOfContents headings={headings} />
				<article
					aria-label="Blog post"
					className="min-w-0 lg:col-start-1 lg:row-start-1"
				>
					<img
						src={post.coverUrl}
						alt={`Cover for ${post.title}`}
						width={960}
						height={540}
						fetchPriority="high"
						className="mb-10 aspect-video w-full rounded-lg object-cover"
					/>
					<PublicContent
						slug={`blogs/${post.slug}`}
						content={post.content}
						prepared={prepared}
						headingMode="article"
					/>
					<div className="h-8" aria-hidden="true" />
					<ShareButtons />
				</article>
			</div>
		</div>
	)
}
