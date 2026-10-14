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
		useAdminProjectGithubRefresh: () => {
			return { mutate: vi.fn(), isPending: false }
		},
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
		LogoUploader: ({ onChange }: { onChange: (key: string) => void }) => (
			<>
				<span>No logo uploaded</span>
				<button
					type="button"
					onClick={() => onChange('tmp/logos/review-1.png')}
				>
					Upload test logo
				</button>
			</>
		),
		ScreenshotUploader: ({ onChange }: { onChange: (key: string) => void }) => (
			<button
				type="button"
				onClick={() => onChange('tmp/screenshots/review-1.png')}
			>
				Upload test screenshot
			</button>
		),
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
		lastCommitAt: null,
		repositoryCreatedAt: null,
		latestReleaseTag: null,
		metadataFetchedAt: null,
	},
}
afterEach(cleanup)
beforeEach(() => {
	mutateAsync
		.mockReset()
		.mockImplementation(({ body }) => Promise.resolve({ ...draft, ...body }))
})

describe('admin draft review form', () => {
	it('syncs pristine repository URLs across refreshes without replacing other edits', async () => {
		const { rerender } = render(<EditProjectForm project={draft} />)
		fireEvent.change(screen.getByLabelText('Tagline'), {
			target: { value: 'Unsaved tagline' },
		})
		fireEvent.blur(screen.getByLabelText('Repository URL'))
		rerender(
			<EditProjectForm
				project={{
					...draft,
					repositoryUrl: 'https://github.com/canonical/repository',
				}}
			/>
		)
		expect(screen.getByLabelText('Repository URL')).toHaveProperty(
			'value',
			'canonical/repository'
		)
		rerender(
			<EditProjectForm
				project={{
					...draft,
					repositoryUrl: 'https://github.com/canonical/renamed-repository',
				}}
			/>
		)
		expect(screen.getByLabelText('Repository URL')).toHaveProperty(
			'value',
			'canonical/renamed-repository'
		)
		expect(screen.getByLabelText('Tagline')).toHaveProperty(
			'value',
			'Unsaved tagline'
		)
		fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }))
		await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1))
		expect(mutateAsync.mock.calls[0]?.[0].body).toMatchObject({
			repositoryUrl: 'canonical/renamed-repository',
			tagline: 'Unsaved tagline',
		})
	})
	it('keeps unsaved values when a GitHub refresh updates the detail query', () => {
		const { rerender } = render(<EditProjectForm project={draft} />)
		fireEvent.change(screen.getByLabelText('Tagline'), {
			target: { value: 'Unsaved tagline' },
		})
		fireEvent.change(screen.getByLabelText('Repository URL'), {
			target: { value: 'unsaved/repository' },
		})
		rerender(
			<EditProjectForm
				project={{
					...draft,
					repositoryUrl: 'https://github.com/canonical/repository',
					github: { ...draft.github, stars: 99, metadataFetchedAt: new Date() },
				}}
			/>
		)
		expect(screen.getByLabelText('Tagline')).toHaveProperty(
			'value',
			'Unsaved tagline'
		)
		expect(screen.getByLabelText('Repository URL')).toHaveProperty(
			'value',
			'unsaved/repository'
		)
	})
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
	it.each(['', ' \n\t '])(
		'blocks Reject with blank feedback %j and submits a trimmed correction without losing edits or uploads',
		async (rejectionReason) => {
			render(<EditProjectForm project={draft} />)
			fireEvent.change(screen.getByLabelText('Tagline'), {
				target: { value: 'Unsaved tagline' },
			})
			fireEvent.click(screen.getByRole('button', { name: 'Upload test logo' }))
			fireEvent.click(
				screen.getByRole('button', { name: 'Upload test screenshot' })
			)
			const reason = screen.getByLabelText('Rejection reason')
			fireEvent.change(reason, { target: { value: rejectionReason } })
			fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
			await waitFor(() =>
				expect(screen.getByRole('alert').textContent).toBe(
					'A rejection reason is required.'
				)
			)
			expect(mutateAsync).not.toHaveBeenCalled()
			expect(reason.getAttribute('aria-invalid')).toBe('true')
			expect(reason.getAttribute('aria-describedby')).toContain(
				screen.getByRole('alert').id
			)
			expect(screen.getByLabelText('Tagline')).toHaveProperty(
				'value',
				'Unsaved tagline'
			)
			fireEvent.change(reason, { target: { value: '  Needs documentation  ' } })
			await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
			fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
			await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1))
			expect(mutateAsync.mock.calls[0]?.[0].body).toMatchObject({
				status: 'rejected',
				rejectionReason: 'Needs documentation',
				tagline: 'Unsaved tagline',
				logo: 'tmp/logos/review-1.png',
				screenshot: 'tmp/screenshots/review-1.png',
			})
		}
	)
	it.each(['draft', 'rejected'] as const)(
		'allows saving or restoring %s after a blank Reject without entering a reason',
		async (status) => {
			render(<EditProjectForm project={{ ...draft, status }} />)
			fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
			await waitFor(() =>
				expect(screen.getByRole('alert').textContent).toBe(
					'A rejection reason is required.'
				)
			)
			expect(mutateAsync).not.toHaveBeenCalled()
			fireEvent.click(
				screen.getByRole('button', {
					name: status === 'rejected' ? 'Restore to Draft' : 'Save Draft',
				})
			)
			await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1))
			expect(mutateAsync.mock.calls[0]?.[0].body).toMatchObject({
				status: 'draft',
				rejectionReason: null,
			})
			await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
		}
	)
	it('uses existing feedback when saving a rejected project', async () => {
		render(
			<EditProjectForm
				project={{
					...draft,
					status: 'rejected',
					rejectionReason: 'Needs documentation',
				}}
			/>
		)
		expect(screen.getByLabelText('Rejection reason')).toHaveProperty(
			'value',
			'Needs documentation'
		)
		fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
		await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1))
		expect(mutateAsync.mock.calls[0]?.[0].body).toMatchObject({
			status: 'rejected',
			rejectionReason: 'Needs documentation',
		})
	})
	it('sends a required rejection reason and provides restore and unpublish actions', async () => {
		const { rerender } = render(<EditProjectForm project={draft} />)
		fireEvent.change(screen.getByLabelText('Rejection reason'), {
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
