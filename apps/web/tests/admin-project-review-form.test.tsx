// @vitest-environment jsdom
import type * as RouterModule from '@tanstack/react-router'
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { ORPCRouterInputs, ORPCRouterOutputs } from '@altstack/api/routers'

import { EditProjectForm } from '#/routes/_main/projects/$id.edit'

const { mutateAsync } = vi.hoisted(() => {
	return {
		mutateAsync:
			vi.fn<
				(
					input: ORPCRouterInputs['admin']['project']['update']
				) => Promise<ORPCRouterOutputs['admin']['project']['update']>
			>(),
	}
})
vi.mock('#/features/admin-projects/queries', () => {
	return {
		useAdminProjectUpdate: () => {
			return { mutateAsync }
		},
		useAdminProjectGithubReadme: () => {
			return { mutateAsync: vi.fn() }
		},
		useAdminProjectGithubMetadata: () => {
			return { mutateAsync: vi.fn() }
		},
		adminProjectQueries: {},
		useAdminProjectGet: vi.fn(),
	}
})
vi.mock('@tanstack/react-router', async () => {
	const actual = await vi.importActual<typeof RouterModule>(
		'@tanstack/react-router'
	)
	return {
		...actual,
		ClientOnly: ({ children }: { children?: React.ReactNode }) => (
			<>{children}</>
		),
	}
})
vi.mock('#/components/block-note/editor', () => {
	return { default: () => null }
})
vi.mock('#/components/category-combobox', () => {
	return {
		CategoryCombobox: () => null,
	}
})
vi.mock('#/components/project-category-badges', () => {
	return {
		ProjectCategoryBadges: () => null,
	}
})
vi.mock('#/components/image-uploader', () => {
	return {
		LogoUploader: () => <span>No logo uploaded</span>,
		ScreenshotUploader: () => null,
	}
})
vi.mock('#/utils/storage', () => {
	return {
		resolveFileUrl: (value: string | null) => value,
	}
})

const draft: ORPCRouterOutputs['admin']['project']['getById'] = {
	id: '550e8400-e29b-41d4-a716-446655440000',
	name: 'Review Tool',
	slug: 'review-tool',
	repositoryUrl: 'https://github.com/review/example',
	tagline: null,
	description: null,
	logo: null,
	screenshot: null,
	content: null,
	websiteUrl: null,
	categories: [],
	status: 'draft',
	createdAt: new Date(),
	updatedAt: new Date(),
	submitterId: null,
	submitter: null,
	rejectionReason: null,
	github: {
		owner: 'review',
		repo: 'example',
		stars: 0,
		forks: 0,
		fetchedAt: new Date(),
	},
}
afterEach(cleanup)
beforeEach(() => {
	mutateAsync
		.mockReset()
		.mockImplementation(({ body }) => Promise.resolve({ ...draft, ...body }))
})

describe('admin draft review form', () => {
	it('renders null copy and media safely and saves an unchanged incomplete draft', async () => {
		render(<EditProjectForm project={draft} />)
		expect(screen.getByLabelText('Tagline')).toHaveProperty('value', '')
		expect(screen.getByLabelText('Description')).toHaveProperty('value', '')
		expect(screen.getByText('No logo uploaded')).toBeTruthy()
		fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }))
		await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1))
		expect(mutateAsync.mock.calls[0]?.[0]).toMatchObject({
			params: { id: draft.id },
			body: {
				status: 'draft',
				tagline: '',
				description: '',
				categorySlugs: [],
			},
		})
	})
	it('preserves draft edits when publish fails validation', async () => {
		mutateAsync.mockRejectedValue(new Error('Cannot publish: logo is required'))
		render(<EditProjectForm project={draft} />)
		fireEvent.change(screen.getByLabelText('Tagline'), {
			target: { value: 'Edited tagline' },
		})
		fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
		await waitFor(() =>
			expect(screen.getByRole('alert').textContent).toContain('Cannot publish')
		)
		expect(screen.getByLabelText('Tagline')).toHaveProperty(
			'value',
			'Edited tagline'
		)
	})
	it('sends an optional rejection reason and provides restore and unpublish actions', async () => {
		const { rerender } = render(<EditProjectForm project={draft} />)
		fireEvent.change(screen.getByLabelText('Rejection reason (optional)'), {
			target: { value: 'Needs documentation' },
		})
		fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
		await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1))
		expect(mutateAsync.mock.calls[0]?.[0].body).toMatchObject({
			status: 'rejected',
			rejectionReason: 'Needs documentation',
		})
		rerender(
			<EditProjectForm
				key="rejected"
				project={{ ...draft, status: 'rejected' }}
			/>
		)
		fireEvent.click(screen.getByRole('button', { name: 'Restore to Draft' }))
		await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(2))
		expect(mutateAsync.mock.calls.at(-1)?.[0].body).toMatchObject({
			status: 'draft',
			rejectionReason: null,
		})
		rerender(
			<EditProjectForm
				key="published"
				project={{ ...draft, status: 'published' }}
			/>
		)
		expect(
			screen.getByRole('button', { name: 'Unpublish to Draft' })
		).toBeTruthy()
	})
})
