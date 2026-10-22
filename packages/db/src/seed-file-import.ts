import type { SeedGithubClient, SeedGithubStatistics } from './seed-file-github'
import type {
	SeedCategory,
	SeedInput,
	SeedProject,
	SeedRecord,
	SeedSource,
} from './seed-file-validation'
import { sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import type { db } from '@altstack/db'
import {
	category,
	categoryPath,
	githubRepository,
	project,
	projectCategory,
} from '@altstack/db/schemas'
import { syncProjectTags } from '@altstack/db/tags'

import { canonicalizeGithubUrl } from '@altstack/shared/lib/github'

import { seedGithubStatisticsSchema } from './seed-file-github'
import {
	failSeed,
	seedCategorySchema,
	seedProjectSchema,
	validatePublication,
	validateSeedIdentities,
	validateSeedRecord,
} from './seed-file-validation'

type SeedDatabase = Pick<typeof db, 'transaction'>
type SeedTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
type Count = { created: number; skipped: number }
export interface SeedSummary {
	dryRun: boolean
	categories: Count
	paths: Count
	projects: Count
	githubRepositories: Count
	relations: Count
	warnings: Array<string>
}
interface CategoryNode {
	id: string
	slug: string
	parentId: string | null
}
interface PlannedCategory {
	record: SeedRecord<SeedCategory>
	node: CategoryNode
	path: string
}
interface PlannedProject {
	record: SeedRecord<SeedProject>
	categoryIds: Array<string>
}

// Same transaction-scoped, schema-scoped lock as the API. Kept here to avoid a
// db -> api dependency. Every plan is rebuilt under this lock before writing.
async function lockIntegrity(tx: SeedTransaction) {
	await tx.execute(sql`SELECT pg_advisory_xact_lock(
		hashtext('altstack.category-integrity'), hashtext(current_schema())
	)`)
}

async function writeRecord(source: SeedSource, write: () => Promise<void>) {
	try {
		await write()
	} catch (error) {
		const cause =
			error instanceof Error && error.cause instanceof Error
				? error.cause
				: error
		failSeed(
			source,
			'$record',
			cause instanceof Error ? cause.message : 'Penulisan database gagal'
		)
	}
}

async function planImport(tx: SeedTransaction, input: SeedInput) {
	await lockIntegrity(tx)
	validateSeedIdentities(input)
	// A transaction owns one pg client; await each query instead of queuing
	// concurrent queries on the same connection.
	const categories = await tx.select().from(category)
	const paths = await tx.select().from(categoryPath)
	const projects = await tx.select().from(project)
	const repositories = await tx.select().from(githubRepository)
	const assignments = await tx.select().from(projectCategory)
	const summary: SeedSummary = {
		dryRun: false,
		categories: { created: 0, skipped: 0 },
		paths: { created: 0, skipped: 0 },
		projects: { created: 0, skipped: 0 },
		githubRepositories: { created: 0, skipped: 0 },
		relations: { created: 0, skipped: 0 },
		warnings: [],
	}
	const bySlug = new Map<string, CategoryNode>(
		categories.map((row) => [row.slug, row])
	)
	const byId = new Map<string, CategoryNode>(
		categories.map((row) => [row.id, row])
	)
	const pending = new Map(
		input.categories.map((record) => [record.value.slug, record])
	)
	const visiting = new Set<string>()
	const direct = new Set(assignments.map((row) => row.categoryId))
	const pathOwners = new Map(paths.map((row) => [row.path, row.categoryId]))
	const newCategories: Array<PlannedCategory> = []
	function ancestry(node: CategoryNode, record: SeedRecord<SeedCategory>) {
		const segments: Array<string> = []
		const visited = new Set<string>()
		let currentId: string | null = node.id
		while (currentId !== null) {
			const current = byId.get(currentId)
			if (!current) {
				failSeed(record.source, 'parentSlug', 'Parent database tidak tersedia')
			}
			if (visited.has(current.id)) {
				failSeed(record.source, 'parentSlug', 'Siklus pada hierarki kategori')
			}
			visited.add(current.id)
			segments.unshift(current.slug)
			if (segments.length > 3) {
				failSeed(
					record.source,
					'parentSlug',
					'Hierarki kategori maksimal tiga tingkat'
				)
			}
			currentId = current.parentId
		}
		return segments.join('/')
	}
	function resolve(
		slug: string,
		requester: SeedRecord<SeedCategory>
	): CategoryNode {
		const existing = bySlug.get(slug)
		if (existing) return existing
		if (visiting.has(slug)) {
			failSeed(
				requester.source,
				'parentSlug',
				`Siklus dependensi kategori: ${slug}`
			)
		}
		const record = pending.get(slug)
		if (!record) {
			failSeed(requester.source, 'parentSlug', `Parent tidak dikenal: ${slug}`)
		}
		if (visiting.size >= 3) {
			failSeed(
				record.source,
				'parentSlug',
				'Hierarki kategori maksimal tiga tingkat'
			)
		}
		visiting.add(slug)
		const parent = record.value.parentSlug
			? resolve(record.value.parentSlug, record)
			: undefined
		if (parent && direct.has(parent.id)) {
			failSeed(
				record.source,
				'parentSlug',
				`Kategori ${parent.slug} mempunyai project langsung; tidak dapat menambahkan anak`
			)
		}
		const node = { id: randomUUID(), slug, parentId: parent?.id ?? null }
		byId.set(node.id, node)
		const path = ancestry(node, record)
		const owner = pathOwners.get(path)
		if (owner && owner !== node.id) {
			failSeed(
				record.source,
				'slug',
				`Path historis dimiliki kategori lain: ${path}`
			)
		}
		pathOwners.set(path, node.id)
		newCategories.push({ record, node, path })
		bySlug.set(slug, node)
		visiting.delete(slug)
		return node
	}
	const existingSlugs = new Set(categories.map((row) => row.slug))
	for (const record of input.categories) {
		if (existingSlugs.has(record.value.slug)) {
			summary.categories.skipped++
			const id = bySlug.get(record.value.slug)?.id
			summary.paths.skipped += paths.filter(
				(row) => row.categoryId === id
			).length
		} else resolve(record.value.slug, record)
	}
	summary.categories.created = newCategories.length
	summary.paths.created = newCategories.length
	const nonLeaves = new Set(
		[...byId.values()].flatMap((node) => (node.parentId ? [node.parentId] : []))
	)
	const projectsBySlug = new Map(projects.map((row) => [row.slug, row.id]))
	const projectsByUrl = new Map(
		projects.map((row) => [
			canonicalizeGithubUrl(row.repositoryUrl).canonicalUrl,
			row.id,
		])
	)
	const repositoriesByUrl = new Map(
		repositories.map((row) => [
			canonicalizeGithubUrl(`${row.owner}/${row.repo}`).canonicalUrl,
			row.projectId,
		])
	)
	const newProjects: Array<PlannedProject> = []
	for (const record of input.projects) {
		const value = record.value
		const slugId = projectsBySlug.get(value.slug)
		const repoId = projectsByUrl.get(value.repositoryUrl)
		if (slugId && repoId && slugId !== repoId) {
			failSeed(
				record.source,
				'repositoryUrl',
				'Konflik: slug dan repository menunjuk dua project berbeda'
			)
		}
		const existingId = slugId ?? repoId
		if (existingId) {
			summary.projects.skipped++
			summary.githubRepositories.skipped += repositories.filter(
				(row) => row.projectId === existingId
			).length
			summary.relations.skipped += assignments.filter(
				(row) => row.projectId === existingId
			).length
			continue
		}
		if (repositoriesByUrl.has(value.repositoryUrl)) {
			failSeed(
				record.source,
				'repositoryUrl',
				'Identitas metadata GitHub sudah dimiliki project lain'
			)
		}
		const categoryIds = value.categorySlugs.map((slug) => {
			const node = bySlug.get(slug)
			if (!node) {
				failSeed(
					record.source,
					'categorySlugs',
					`Kategori tidak dikenal: ${slug}`
				)
			}
			if (nonLeaves.has(node.id)) {
				failSeed(
					record.source,
					'categorySlugs',
					`Kategori harus berupa daun: ${slug}`
				)
			}
			return node.id
		})
		newProjects.push({ record, categoryIds })
		summary.relations.created += categoryIds.length
	}
	summary.projects.created = newProjects.length
	summary.githubRepositories.created = newProjects.length
	return { newCategories, newProjects, repositories, summary }
}

export async function importSeedFiles(
	database: SeedDatabase,
	input: SeedInput,
	options: { dryRun?: boolean; github?: SeedGithubClient } = {}
): Promise<SeedSummary> {
	// Validate even injected input; no environment, connection or network work on
	// module import. The caller owns and closes the database connection.
	const validated: SeedInput = {
		categories: input.categories.map((record) =>
			validateSeedRecord(record, seedCategorySchema)
		),
		projects: input.projects.map((record) =>
			validateSeedRecord(record, seedProjectSchema)
		),
	}
	for (const record of validated.projects) validatePublication(record)
	const prepared = new Map<
		string,
		{ statistics: SeedGithubStatistics; fetchedAt: Date }
	>()
	const warnings: Array<string> = []
	if (options.github) {
		const initial = await database.transaction((tx) =>
			planImport(tx, validated)
		)
		for (const { record } of initial.newProjects) {
			const identity = canonicalizeGithubUrl(record.value.repositoryUrl)
			let statistics: SeedGithubStatistics
			try {
				statistics = seedGithubStatisticsSchema.parse(
					await options.github.statistics(identity.owner, identity.repo)
				)
			} catch (error) {
				failSeed(
					record.source,
					'repositoryUrl',
					`Statistik GitHub gagal: ${error instanceof Error ? error.message : 'unknown error'}`
				)
			}
			record.value.repositoryUrl = statistics.repositoryUrl
			const fetchedAt = new Date()
			prepared.set(record.value.slug, { statistics, fetchedAt })
			const resolved = canonicalizeGithubUrl(statistics.repositoryUrl)
			try {
				const readme = await options.github.readme(
					resolved.owner,
					resolved.repo
				)
				if (!readme?.trim()) {
					throw new Error('README tidak tersedia')
				}
				record.value.content ??= readme
			} catch (error) {
				warnings.push(
					`${record.source.file}: ${record.source.location}: content: ${error instanceof Error ? error.message : 'README tidak tersedia'}`
				)
			}
		}
	}
	// Recheck identities after GitHub rename/transfer resolution and re-read the
	// database after network work, using the same lock as hierarchy/assignment APIs.
	return database.transaction(async (tx) => {
		const plan = await planImport(tx, validated)
		const githubIds = new Map(
			plan.repositories.flatMap((row) =>
				row.githubRepositoryId === null
					? []
					: [[row.githubRepositoryId, row.projectId] as const]
			)
		)
		for (const { record } of plan.newProjects) {
			const enrichment = prepared.get(record.value.slug)
			if (options.github && !enrichment) {
				failSeed(
					record.source,
					'repositoryUrl',
					'Database berubah selama persiapan GitHub; ulangi impor'
				)
			}
			if (enrichment) {
				const id = enrichment.statistics.githubRepositoryId
				if (githubIds.has(id)) {
					failSeed(
						record.source,
						'repositoryUrl',
						'ID repository GitHub sudah dimiliki project lain'
					)
				}
				githubIds.set(id, record.value.slug)
			}
		}
		if (!options.dryRun) {
			for (const { record, node, path } of plan.newCategories) {
				await writeRecord(record.source, async () => {
					const value = record.value
					await tx
						.insert(category)
						.values({ ...value, id: node.id, parentId: node.parentId })
					await tx.insert(categoryPath).values({ categoryId: node.id, path })
				})
			}
			for (const { record, categoryIds } of plan.newProjects) {
				await writeRecord(record.source, async () => {
					const value = record.value
					const id = randomUUID()
					await tx.insert(project).values({ ...value, id })
					const identity = canonicalizeGithubUrl(value.repositoryUrl)
					const enrichment = prepared.get(value.slug)
					const stats = enrichment?.statistics
					await tx.insert(githubRepository).values({
						projectId: id,
						owner: identity.owner,
						repo: identity.repo,
						stars: stats?.stars ?? 0,
						forks: stats?.forks ?? 0,
						githubRepositoryId: stats?.githubRepositoryId ?? null,
						fetchedAt: enrichment?.fetchedAt ?? new Date(0),
						repositoryCreatedAt: stats?.repositoryCreatedAt ?? null,
						lastCommitAt: stats?.lastCommitAt ?? null,
						latestReleaseTag: stats?.latestReleaseTag ?? null,
						metadataFetchedAt: enrichment?.fetchedAt ?? null,
					})
					if (stats?.topics) await syncProjectTags(tx, id, stats.topics)
					if (categoryIds.length > 0) {
						await tx.insert(projectCategory).values(
							categoryIds.map((categoryId) => {
								return { projectId: id, categoryId }
							})
						)
					}
				})
			}
		}
		return { ...plan.summary, dryRun: options.dryRun ?? false, warnings }
	})
}
