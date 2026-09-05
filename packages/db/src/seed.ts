import { eq } from 'drizzle-orm'
import { Octokit } from 'octokit'

import { db } from '@altstack/db'
import {
	category,
	githubRepository,
	project,
	projectCategory,
} from '@altstack/db/schemas'

import { env } from '@altstack/env/server'

const octokit: Octokit = new Octokit({
	auth: env.GITHUB_TOKEN,
	userAgent: env.APP_NAME,
	timeZone: 'Asia/Jakarta',
})

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
	},
]

const getReadmeFile = async (owner: string, repo: string) => {
	try {
		const { data } = await octokit.rest.repos.getReadme({
			owner,
			repo,
		})

		if (data.encoding === 'base64') {
			return Buffer.from(data.content, 'base64').toString('utf-8')
		}

		return null
	} catch (error) {
		console.debug(`Failed to get README for ${owner}/${repo}`, error)
		return null
	}
}

const getGithubStats = async (owner: string, repo: string) => {
	try {
		const { data } = await octokit.rest.repos.get({
			owner,
			repo,
		})

		return data
	} catch (error) {
		console.debug(`Failed to get README for ${owner}/${repo}`, error)
		throw error
	}
}

interface CategoryItem {
	name: string
	slug: string
	description: string
}

const seedCategories: Array<CategoryItem> = [
	{
		name: 'Frontend',
		slug: 'frontend',
		description: 'UI frameworks, client-side routing, and browser tooling.',
	},
	{
		name: 'Backend',
		slug: 'backend',
		description: 'Servers, APIs, and server-side frameworks.',
	},
	{
		name: 'Database',
		slug: 'database',
		description: 'ORMs, query builders, and database tooling.',
	},
	{
		name: 'Auth',
		slug: 'auth',
		description: 'Authentication and authorization libraries.',
	},
	{
		name: 'Devtools',
		slug: 'devtools',
		description:
			'Developer productivity: agents, validators, formatters, linters.',
	},
	{
		name: 'Styling',
		slug: 'styling',
		description: 'CSS frameworks and component libraries.',
	},
]

// Deterministic assignments: project slug -> category slugs (1-2 each).
const seedProjectCategories: Record<string, Array<string>> = {
	opencode: ['devtools'],
	vite: ['frontend', 'devtools'],
	'drizzle-orm': ['backend', 'database'],
	hono: ['backend'],
	'better-auth': ['backend', 'auth'],
	'tanstack-router': ['frontend'],
	zod: ['devtools'],
	trpc: ['backend'],
	nextjs: ['frontend', 'backend'],
	tailwindcss: ['frontend', 'styling'],
	'shadcn-ui': ['frontend', 'styling'],
	orpc: ['backend'],
	prisma: ['backend', 'database'],
	biome: ['devtools'],
	prettier: ['devtools'],
}

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

		try {
			const content = await getReadmeFile(projectEntry.owner, projectEntry.repo)

			const { stargazers_count, forks_count } = await getGithubStats(
				projectEntry.owner,
				projectEntry.repo
			)

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
					stars: stargazers_count,
					forks: forks_count,
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

async function seedCategoryAssignments() {
	// Idempotent taxonomy: insert missing categories, never update existing rows.
	await db
		.insert(category)
		.values(seedCategories)
		.onConflictDoNothing({ target: category.slug })
	console.debug(`Seeded categories: ${seedCategories.length}`)

	// Resolve ids deterministically by slug; skip unknown slugs without failing.
	const [projects, categories] = await Promise.all([
		db.select({ id: project.id, slug: project.slug }).from(project),
		db.select({ id: category.id, slug: category.slug }).from(category),
	])
	const projectBySlug = new Map(projects.map((p) => [p.slug, p.id]))
	const categoryBySlug = new Map(categories.map((c) => [c.slug, c.id]))

	const values: Array<{ projectId: string; categoryId: string }> = []
	for (const [projectSlug, categorySlugs] of Object.entries(
		seedProjectCategories
	)) {
		const projectId = projectBySlug.get(projectSlug)
		if (!projectId) {
			console.debug(`Skipping assignment: unknown project ${projectSlug}`)
			continue
		}

		for (const categorySlug of categorySlugs) {
			const categoryId = categoryBySlug.get(categorySlug)
			if (!categoryId) {
				console.debug(`Skipping assignment: unknown category ${categorySlug}`)
				continue
			}

			values.push({ projectId, categoryId })
		}
	}

	if (values.length === 0) {
		return
	}

	// Insert missing links only; reruns create no duplicates, user data untouched.
	await db
		.insert(projectCategory)
		.values(values)
		.onConflictDoNothing({
			target: [projectCategory.projectId, projectCategory.categoryId],
		})
	console.debug(`Seeded project-category assignments: ${values.length}`)
}

await seed()
	.then(() => console.debug('Project seed complete'))
	.catch((e) => {
		console.debug(e)
		process.exitCode = 1
	})

await seedCategoryAssignments()
	.then(() => console.debug('Seed complete'))
	.catch((e) => {
		console.debug(e)
		process.exitCode = 1
	})
