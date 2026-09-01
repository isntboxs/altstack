import { eq } from 'drizzle-orm'

import { db } from '@altstack/db'
import { githubRepository, project } from '@altstack/db/schemas'

interface ProjectItem {
	name: string
	slug: string
	repositoryUrl: string
	owner: string
	repo: string
	tagline: string
	description: string
	logo: string
	websiteUrl?: string
	stars: number
	forks: number
	content: string | null
}

const seedProjects: Array<ProjectItem> = [
	{
		name: 'OpenCode',
		slug: 'opencode',
		repositoryUrl: 'https://github.com/anomalyco/opencode',
		owner: 'anomalyco',
		repo: 'opencode',
		tagline: 'Open source AI coding agent for terminal, IDE, or desktop.',
		description:
			'Open source AI coding agent that runs in terminal, IDE or desktop, supporting 75+ LLM providers with no code storage.',
		logo: 'https://github.com/anomalyco.png',
		websiteUrl: 'https://opencode.ai',
		stars: 2450,
		forks: 120,
		content:
			'# OpenCode\nOpen source AI coding agent that runs in terminal, IDE or desktop.',
	},
	{
		name: 'Vite',
		slug: 'vite',
		repositoryUrl: 'https://github.com/vitejs/vite',
		owner: 'vitejs',
		repo: 'vite',
		tagline: 'Next generation frontend tooling. Fast dev, instant HMR.',
		description:
			'Frontend build tool that delivers instant server start, lightning fast HMR and optimized builds powered by native ESM and esbuild.',
		logo: 'https://vitejs.dev/logo.svg',
		websiteUrl: 'https://vitejs.dev',
		stars: 64500,
		forks: 6200,
		content: '# Vite\nNext generation frontend tooling.',
	},
	{
		name: 'Drizzle ORM',
		slug: 'drizzle-orm',
		repositoryUrl: 'https://github.com/drizzle-team/drizzle-orm',
		owner: 'drizzle-team',
		repo: 'drizzle-orm',
		tagline: 'TypeScript ORM that feels like SQL.',
		description:
			'Lightweight TypeScript ORM with SQL-like syntax, zero dependencies, auto-migrations and support for PostgreSQL, MySQL and SQLite.',
		logo: 'https://avatars.githubusercontent.com/u/108468352?s=200&v=4',
		websiteUrl: 'https://orm.drizzle.team',
		stars: 15400,
		forks: 800,
		content: '# Drizzle ORM\nTypeScript ORM that feels like SQL.',
	},
	{
		name: 'Hono',
		slug: 'hono',
		repositoryUrl: 'https://github.com/honojs/hono',
		owner: 'honojs',
		repo: 'hono',
		tagline: 'Fast, lightweight web framework for the edge.',
		description:
			'Ultrafast web framework for Cloudflare Workers, Deno, Bun and Node.js with middleware, JSX and RPC support.',
		logo: 'https://hono.dev/images/logo.png',
		websiteUrl: 'https://hono.dev',
		stars: 7200,
		forks: 400,
		content: '# Hono\nFast, lightweight web framework for the edge.',
	},
	{
		name: 'Better Auth',
		slug: 'better-auth',
		repositoryUrl: 'https://github.com/better-auth/better-auth',
		owner: 'better-auth',
		repo: 'better-auth',
		tagline: 'The most comprehensive auth library for TypeScript.',
		description:
			'Full-stack authentication library with email/password, OAuth, 2FA, organization support and framework-agnostic adapters.',
		logo: 'https://avatars.githubusercontent.com/u/182022260?s=200&v=4',
		websiteUrl: 'https://www.better-auth.com',
		stars: 5200,
		forks: 350,
		content:
			'# Better Auth\nThe most comprehensive auth library for TypeScript.',
	},
	{
		name: 'TanStack Router',
		slug: 'tanstack-router',
		repositoryUrl: 'https://github.com/TanStack/router',
		owner: 'TanStack',
		repo: 'router',
		tagline: 'Type-safe, powerful router for React.',
		description:
			'Fully type-safe router for React with search param validation, caching, preloading and file-based routing.',
		logo: 'https://avatars.githubusercontent.com/u/72518640?s=200&v=4',
		websiteUrl: 'https://tanstack.com/router',
		stars: 7800,
		forks: 450,
		content: '# TanStack Router\nType-safe, powerful router for React.',
	},
	{
		name: 'Zod',
		slug: 'zod',
		repositoryUrl: 'https://github.com/colinhacks/zod',
		owner: 'colinhacks',
		repo: 'zod',
		tagline: 'TypeScript-first schema validation.',
		description:
			'TypeScript-first schema declaration and validation library with static type inference and composable declarative schemas.',
		logo: 'https://avatars.githubusercontent.com/u/10856680?s=200&v=4',
		websiteUrl: 'https://zod.dev',
		stars: 34200,
		forks: 400,
		content: '# Zod\nTypeScript-first schema validation.',
	},
	{
		name: 'tRPC',
		slug: 'trpc',
		repositoryUrl: 'https://github.com/trpc/trpc',
		owner: 'trpc',
		repo: 'trpc',
		tagline: 'End-to-end typesafe APIs made easy.',
		description:
			'Build end-to-end typesafe APIs without schemas or code generation. Autocomplete your API on the client like it is local.',
		logo: 'https://avatars.githubusercontent.com/u/78011399?s=200&v=4',
		websiteUrl: 'https://trpc.io',
		stars: 30500,
		forks: 800,
		content: '# tRPC\nEnd-to-end typesafe APIs made easy.',
	},
	{
		name: 'Next.js',
		slug: 'nextjs',
		repositoryUrl: 'https://github.com/vercel/next.js',
		owner: 'vercel',
		repo: 'next.js',
		tagline: 'The React framework for production.',
		description:
			'React framework for production with hybrid static and server rendering, route handlers, image optimization and edge runtime.',
		logo: 'https://avatars.githubusercontent.com/u/14985020?s=200&v=4',
		websiteUrl: 'https://nextjs.org',
		stars: 118000,
		forks: 26000,
		content: '# Next.js\nThe React framework for production.',
	},
	{
		name: 'Tailwind CSS',
		slug: 'tailwindcss',
		repositoryUrl: 'https://github.com/tailwindlabs/tailwindcss',
		owner: 'tailwindlabs',
		repo: 'tailwindcss',
		tagline: 'Utility-first CSS framework for rapid UI.',
		description:
			'Utility-first CSS framework packed with classes for building custom designs directly in markup without leaving HTML.',
		logo: 'https://avatars.githubusercontent.com/u/67109815?s=200&v=4',
		websiteUrl: 'https://tailwindcss.com',
		stars: 79500,
		forks: 3800,
		content: '# Tailwind CSS\nUtility-first CSS framework.',
	},
	{
		name: 'shadcn/ui',
		slug: 'shadcn-ui',
		repositoryUrl: 'https://github.com/shadcn-ui/ui',
		owner: 'shadcn-ui',
		repo: 'ui',
		tagline: 'Beautifully designed components you can copy.',
		description:
			'Collection of beautifully designed, accessible components built with Radix UI and Tailwind CSS you can copy into your apps.',
		logo: 'https://avatars.githubusercontent.com/u/139895814?s=200&v=4',
		websiteUrl: 'https://ui.shadcn.com',
		stars: 49800,
		forks: 3200,
		content: '# shadcn/ui\nBeautifully designed components.',
	},
	{
		name: 'oRPC',
		slug: 'orpc',
		repositoryUrl: 'https://github.com/unnoq/orpc',
		owner: 'unnoq',
		repo: 'orpc',
		tagline: 'Type-safe RPC like tRPC, supercharged for OpenAPI.',
		description:
			'Type-safe RPC framework with contract-first design, OpenAPI generation and seamless TanStack Query integration for oRPC.',
		logo: 'https://avatars.githubusercontent.com/u/182467336?s=200&v=4',
		websiteUrl: 'https://orpc.unnoq.com',
		stars: 2100,
		forks: 120,
		content: '# oRPC\nType-safe RPC like tRPC, supercharged for OpenAPI.',
	},
	{
		name: 'Prisma',
		slug: 'prisma',
		repositoryUrl: 'https://github.com/prisma/prisma',
		owner: 'prisma',
		repo: 'prisma',
		tagline: 'Next-generation ORM for Node.js and TypeScript.',
		description:
			'Type-safe database toolkit with auto-generated client, declarative migrations and Prisma Studio for modern TypeScript apps.',
		logo: 'https://avatars.githubusercontent.com/u/17219288?s=200&v=4',
		websiteUrl: 'https://www.prisma.io',
		stars: 38500,
		forks: 1500,
		content: '# Prisma\nNext-generation ORM for Node.js and TypeScript.',
	},
	{
		name: 'Biome',
		slug: 'biome',
		repositoryUrl: 'https://github.com/biomejs/biome',
		owner: 'biomejs',
		repo: 'biome',
		tagline: 'One toolchain for web projects. Format, lint and more.',
		description:
			'Fast formatter and linter for JavaScript and TypeScript written in Rust, designed to replace ESLint and Prettier.',
		logo: 'https://avatars.githubusercontent.com/u/145374359?s=200&v=4',
		websiteUrl: 'https://biomejs.dev',
		stars: 12200,
		forks: 400,
		content: '# Biome\nOne toolchain for web projects.',
	},
	{
		name: 'Prettier',
		slug: 'prettier',
		repositoryUrl: 'https://github.com/prettier/prettier',
		owner: 'prettier',
		repo: 'prettier',
		tagline: 'Opinionated code formatter.',
		description:
			'Opinionated code formatter that enforces consistent style by parsing and re-printing code from scratch with minimal options.',
		logo: 'https://avatars.githubusercontent.com/u/25822731?s=200&v=4',
		websiteUrl: 'https://prettier.io',
		stars: 47500,
		forks: 3100,
		content: '# Prettier\nOpinionated code formatter.',
	},
]

async function seed() {
	const failed: Array<string> = []

	for (const projectEntry of seedProjects) {
		// Deterministic idempotency: check canonical repositoryUrl first (and slug)
		const [existingByRepo] = await db
			.select({ id: project.id })
			.from(project)
			.where(eq(project.repositoryUrl, projectEntry.repositoryUrl))
			.limit(1)

		if (existingByRepo) {
			console.debug(`Skipping existing project: ${projectEntry.slug}`)
			continue
		}

		const [existingBySlug] = await db
			.select({ id: project.id })
			.from(project)
			.where(eq(project.slug, projectEntry.slug))
			.limit(1)

		if (existingBySlug) {
			console.debug(`Skipping existing slug: ${projectEntry.slug}`)
			continue
		}

		// Use fully checked-in metadata — no live GitHub requests in R0
		const { stars, forks, content } = projectEntry

		try {
			await db.transaction(async (tx) => {
				const [newProject] = await tx
					.insert(project)
					.values({
						name: projectEntry.name,
						slug: projectEntry.slug,
						repositoryUrl: projectEntry.repositoryUrl,
						tagline: projectEntry.tagline,
						description: projectEntry.description,
						logo: projectEntry.logo,
						websiteUrl: projectEntry.websiteUrl ?? null,
						content,
						status: 'published',
					})
					.returning({ id: project.id })

				if (!newProject) {
					throw new Error(`Failed to insert project ${projectEntry.slug}`)
				}

				await tx.insert(githubRepository).values({
					projectId: newProject.id,
					owner: projectEntry.owner,
					repo: projectEntry.repo,
					stars,
					forks,
					fetchedAt: new Date(),
				})
			})
			console.debug(`Seeded: ${projectEntry.slug}`)
		} catch (error) {
			console.debug(`Failed to seed ${projectEntry.slug}:`, error)
			failed.push(projectEntry.slug)
		}
	}

	if (failed.length > 0) {
		throw new Error(`Seed failed for: ${failed.join(', ')}`)
	}
}

await seed()
	.then(() => console.debug('Seed complete'))
	.catch((e) => {
		console.debug(e)
		process.exitCode = 1
	})
