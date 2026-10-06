import { openapi } from '@orpc/openapi'

import { baseContract } from '@altstack/api/contracts/base'

import {
	adminCreateProjectInputSchema,
	adminCreateProjectOutputSchema,
	adminDeleteProjectInputSchema,
	adminDeleteProjectOutputSchema,
	adminGetProjectByIdInputSchema,
	adminListProjectInputSchema,
	adminListProjectOutputSchema,
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
			method: 'GET',
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
			method: 'GET',
			summary: 'Admin list projects',
			description:
				'Paginated list with optional status and name filters and sorting.',
			tags: ['AdminProjects'],
			operationId: 'listAdminProjects',
			successStatus: 200,
			successDescription: 'Projects listed',
		})
	)
	.input(adminListProjectInputSchema)
	.output(adminListProjectOutputSchema)

// RPC compatibility for the current project form; admin.category.list owns REST.
const listAdminCategoriesContract = baseContract
	.input(listCategoriesInputSchema)
	.output(listCategoriesOutputSchema)

export const adminProjectContract = {
	create: createAdminProjectContract,
	getById: getAdminProjectByIdContract,
	update: updateAdminProjectContract,
	remove: deleteAdminProjectContract,
	list: listAdminProjectsContract,
	listCategories: listAdminCategoriesContract,
} as const
