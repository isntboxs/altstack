import { openapi } from '@orpc/openapi'

import { baseContract } from '@altstack/api/contracts/base'

import {
	adminCreateProjectInputSchema,
	adminCreateProjectOutputSchema,
	adminDeleteProjectInputSchema,
	adminDeleteProjectOutputSchema,
	adminGetProjectByIdInputSchema,
	adminGithubMetadataInputSchema,
	adminGithubRefreshInputSchema,
	adminGithubRefreshOutputSchema,
	adminGithubReadmeInputSchema,
	adminGithubReadmeOutputSchema,
	adminGithubMetadataOutputSchema,
	adminListProjectInputSchema,
	adminListProjectOutputSchema,
	adminProjectReviewHistoryInputSchema,
	adminProjectReviewHistoryOutputSchema,
	adminUpdateProjectInputSchema,
	adminUpdateProjectOutputSchema,
} from '@altstack/shared'
import {
	listCategoriesInputSchema,
	listCategoriesOutputSchema,
} from '@altstack/shared/schemas/project'

const createAdminProjectContract = baseContract
	.meta(
		openapi({
			path: '/admin/projects',
			method: 'POST',
			inputStructure: 'detailed',
			outputStructure: 'compact',
			summary: 'Admin create project',
			description:
				'Create project with optional status (draft/published, defaults to published). Duplicate repo/slug → 409.',
			tags: ['AdminProjects'],
			operationId: 'createAdminProject',
			successStatus: 201,
			successDescription: 'Project created',
		})
	)
	.input(adminCreateProjectInputSchema)
	.output(adminCreateProjectOutputSchema)

const updateAdminProjectContract = baseContract
	.meta(
		openapi({
			path: '/admin/projects/{id}',
			method: 'PATCH',
			inputStructure: 'detailed',
			outputStructure: 'compact',
			paramsStyles: { id: 'primitive' },
			summary: 'Admin update project',
			description:
				'Partial update. New logo/screenshot arrive as tmp keys and are promoted to projects/{slug}/. Slug rename moves the folder. Duplicate repo/slug → 409.',
			tags: ['AdminProjects'],
			operationId: 'updateAdminProject',
			successStatus: 200,
			successDescription: 'Project updated',
		})
	)
	.input(adminUpdateProjectInputSchema)
	.output(adminUpdateProjectOutputSchema)

const deleteAdminProjectContract = baseContract
	.meta(
		openapi({
			path: '/admin/projects/{id}',
			method: 'DELETE',
			inputStructure: 'detailed',
			outputStructure: 'compact',
			paramsStyles: { id: 'primitive' },
			summary: 'Admin delete project',
			description:
				'Hard delete project with its images. Missing project → 404.',
			tags: ['AdminProjects'],
			operationId: 'deleteAdminProject',
			successStatus: 200,
			successDescription: 'Project deleted',
		})
	)
	.input(adminDeleteProjectInputSchema)
	.output(adminDeleteProjectOutputSchema)

const getAdminProjectByIdContract = baseContract
	.meta(
		openapi({
			path: '/admin/projects/{id}',
			method: 'QUERY',
			inputStructure: 'detailed',
			outputStructure: 'compact',
			paramsStyles: { id: 'primitive' },
			summary: 'Admin get project by id',
			description:
				'Get a single project (image fields are storage keys), for the admin edit form. Any status.',
			tags: ['AdminProjects'],
			operationId: 'getAdminProjectById',
			successStatus: 200,
			successDescription: 'Project found',
		})
	)
	.input(adminGetProjectByIdInputSchema)
	.output(adminUpdateProjectOutputSchema)

const listAdminProjectsContract = baseContract
	.meta(
		openapi({
			path: '/admin/projects',
			method: 'QUERY',
			inputStructure: 'detailed',
			outputStructure: 'compact',
			queryStyles: {
				status: 'primitive',
				needsReview: 'primitive',
				name: 'primitive',
				sort: 'primitive',
				order: 'primitive',
				page: 'primitive',
				limit: 'primitive',
			},
			summary: 'Admin list projects',
			description:
				'Paginated list with optional status, name and needsReview filters and sorting. Needs review means a draft with a submitter.',
			tags: ['AdminProjects'],
			operationId: 'listAdminProjects',
			successStatus: 200,
			successDescription: 'Projects listed',
		})
	)
	.input(adminListProjectInputSchema)
	.output(adminListProjectOutputSchema)

const reviewHistoryAdminProjectContract = baseContract
	.meta(
		openapi({
			path: '/admin/projects/{id}/review-history',
			method: 'QUERY',
			inputStructure: 'detailed',
			outputStructure: 'compact',
			paramsStyles: { id: 'primitive' },
			queryStyles: { page: 'primitive', limit: 'primitive' },
			summary: 'Admin project review history',
			description:
				'Paginated creation, submission and status change events, newest first. Missing project → 404.',
			tags: ['AdminProjects'],
			operationId: 'reviewHistoryAdminProject',
			successStatus: 200,
			successDescription: 'Review history listed',
		})
	)
	.input(adminProjectReviewHistoryInputSchema)
	.output(adminProjectReviewHistoryOutputSchema)

// RPC compatibility for the current project form; admin.category.list owns REST.
const listAdminCategoriesContract = baseContract
	.input(listCategoriesInputSchema)
	.output(listCategoriesOutputSchema)

const githubMetadataAdminProjectContract = baseContract
	.meta(
		openapi({
			path: '/admin/projects/github-metadata',
			method: 'QUERY',
			inputStructure: 'compact',
			outputStructure: 'compact',
			summary: 'Admin fetch GitHub metadata',
			description:
				'Preview description and HTTP(S) homepage from a public GitHub repository. Accepts {repositoryUrl} in the QUERY JSON body. Does not save or update the project.',
			tags: ['AdminProjects'],
			operationId: 'githubMetadataAdminProject',
			successStatus: 200,
			successDescription: 'GitHub metadata fetched',
		})
	)
	.input(adminGithubMetadataInputSchema)
	.output(adminGithubMetadataOutputSchema)

const githubReadmeAdminProjectContract = baseContract
	.meta(
		openapi({
			path: '/admin/projects/github-readme',
			method: 'QUERY',
			inputStructure: 'compact',
			outputStructure: 'compact',
			summary: 'Admin import GitHub README preview',
			description:
				'Fetch and sanitize the preferred README of a public repository at its default branch commit. Accepts {repositoryUrl} in the QUERY JSON body. Returns normalized Markdown, source and warnings. Does not save or update the project.',
			tags: ['AdminProjects'],
			operationId: 'githubReadmeAdminProject',
			successStatus: 200,
			successDescription: 'GitHub README fetched',
		})
	)
	.input(adminGithubReadmeInputSchema)
	.output(adminGithubReadmeOutputSchema)

const githubRefreshAdminProjectContract = baseContract
	.meta(
		openapi({
			path: '/admin/projects/{id}/github-refresh',
			method: 'POST',
			inputStructure: 'detailed',
			outputStructure: 'compact',
			paramsStyles: { id: 'primitive' },
			summary: 'Admin refresh GitHub statistics',
			description:
				'Atomically refresh stored statistics and metadata. Failed fetches preserve the previous snapshot. Repository changes or canonical identity conflicts return 409.',
			tags: ['AdminProjects'],
			operationId: 'githubRefreshAdminProject',
			successStatus: 200,
			successDescription: 'Stored GitHub statistics refreshed',
		})
	)
	.input(adminGithubRefreshInputSchema)
	.output(adminGithubRefreshOutputSchema)

export const adminProjectContract = {
	githubRefresh: githubRefreshAdminProjectContract,
	githubReadme: githubReadmeAdminProjectContract,
	githubMetadata: githubMetadataAdminProjectContract,
	create: createAdminProjectContract,
	getById: getAdminProjectByIdContract,
	update: updateAdminProjectContract,
	remove: deleteAdminProjectContract,
	list: listAdminProjectsContract,
	reviewHistory: reviewHistoryAdminProjectContract,
	listCategories: listAdminCategoriesContract,
} as const
