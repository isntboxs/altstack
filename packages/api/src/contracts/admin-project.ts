import { openapi } from '@orpc/openapi'

import { baseContract } from '@altstack/api/contracts/base'

import {
	adminCreateProjectInputSchema,
	adminCreateProjectOutputSchema,
	adminDeleteProjectInputSchema,
	adminDeleteProjectOutputSchema,
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
				'Create project directly as published. Duplicate repo/slug → 409.',
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

const listAdminProjectsContract = baseContract
	.meta(
		openapi({
			path: '/admin/projects',
			method: 'GET',
			summary: 'Admin list projects',
			description: 'Paginated list with optional status filter.',
			tags: ['AdminProjects'],
			operationId: 'listAdminProjects',
			successStatus: 200,
			successDescription: 'Projects listed',
		})
	)
	.input(adminListProjectInputSchema)
	.output(adminListProjectOutputSchema)

const listAdminCategoriesContract = baseContract
	.meta(
		openapi({
			path: '/admin/categories',
			method: 'GET',
			summary: 'Admin list categories',
			description:
				'List all categories ordered by name, including ones with no published projects. For the admin creation form.',
			tags: ['AdminProjects'],
			operationId: 'listAdminCategories',
			successStatus: 200,
			successDescription: 'Categories listed',
		})
	)
	.input(listCategoriesInputSchema)
	.output(listCategoriesOutputSchema)

export const adminProjectContract = {
	create: createAdminProjectContract,
	update: updateAdminProjectContract,
	remove: deleteAdminProjectContract,
	list: listAdminProjectsContract,
	listCategories: listAdminCategoriesContract,
} as const
