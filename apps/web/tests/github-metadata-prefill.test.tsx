// @vitest-environment jsdom
import type * as RouterModule from '@tanstack/react-router'
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { ORPCRouterOutputs } from '@altstack/api/routers'

import { EditProjectForm } from '#/routes/_main/projects/$id.edit'
import { CreateProjectForm } from '#/routes/_main/projects/create'

type Metadata = ORPCRouterOutputs['admin']['project']['githubMetadata']
const mocks = vi.hoisted(() => {
	return {
		fetch: vi.fn<() => Promise<Metadata>>(),
		save: vi.fn(),
		savePending: false,
	}
})
vi.mock('#/features/admin-projects/queries', () => {
	return {
		useAdminProjectGithubRefresh: () => {
			return { mutate: vi.fn(), isPending: false }
		},
		useAdminProjectGithubReadme: () => {
			return { mutateAsync: vi.fn() }
		},
		useAdminProjectGithubMetadata: () => {
			return { mutateAsync: mocks.fetch }
		},
		useAdminProjectCreate: () => {
			return {
				mutateAsync: mocks.save,
				isPending: mocks.savePending,
			}
		},
		useAdminProjectUpdate: () => {
			return {
				mutateAsync: mocks.save,
				isPending: mocks.savePending,
			}
		},
		adminProjectQueries: {},
		useAdminProjectGet: vi.fn(),
	}
})
vi.mock('@tanstack/react-router', async () => {
	return {
		...(await vi.importActual<typeof RouterModule>('@tanstack/react-router')),
		ClientOnly: ({ children }: { children?: React.ReactNode }) => (
			<>{children}</>
		),
		Link: ({ children }: { children?: React.ReactNode }) => (
			<span>{children}</span>
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
vi.mock('#/utils/storage', () => {
	return {
		resolveFileUrl: (key: string | null) => key,
	}
})
vi.mock('#/components/image-uploader', () => {
	return {
		LogoUploader: ({
			onChange,
			onDisplayUrlChange,
		}: {
			onChange: (key: string) => void
			onDisplayUrlChange: (url: string) => void
		}) => (
			<button
				type="button"
				onClick={() => {
					onChange('tmp/logos/metadata-1.png')
					onDisplayUrlChange('https://test.invalid/logo.png')
				}}
			>
				Upload test logo
			</button>
		),
		ScreenshotUploader: ({
			onChange,
			onDisplayUrlChange,
		}: {
			onChange: (key: string) => void
			onDisplayUrlChange: (url: string) => void
		}) => (
			<button
				type="button"
				onClick={() => {
					onChange('tmp/screenshots/metadata-1.png')
					onDisplayUrlChange('https://test.invalid/screenshot.png')
				}}
			>
				Upload test screenshot
			</button>
		),
	}
})

const draft: ORPCRouterOutputs['admin']['project']['getById'] = {
	id: '550e8400-e29b-41d4-a716-446655440000',
	name: 'Metadata Tool',
	slug: 'metadata-tool',
	repositoryUrl: 'https://github.com/original/tool',
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
		owner: 'original',
		repo: 'tool',
		stars: 10,
		forks: 1,
		fetchedAt: new Date(),
		lastCommitAt: null,
		repositoryCreatedAt: null,
		latestReleaseTag: null,
		metadataFetchedAt: null,
	},
}
const metadata: Metadata = {
	repositoryUrl: 'https://github.com/resolved/tool',
	description: 'Suggested description',
	websiteUrl: 'https://example.com',
}
function change(label: string, value: string) {
	fireEvent.change(screen.getByLabelText(label), { target: { value } })
}
async function fetchPreview() {
	fireEvent.click(screen.getByRole('button', { name: 'Fetch from GitHub' }))
	return within(await screen.findByRole('dialog'))
}
function deferred<T = Metadata>() {
	let resolve!: (value: T) => void
	let reject!: (error: Error) => void
	const promise = new Promise<T>((success, failure) => {
		resolve = success
		reject = failure
	})
	return { promise, resolve, reject }
}
beforeEach(() => {
	mocks.fetch.mockReset().mockResolvedValue(metadata)
	mocks.save
		.mockReset()
		.mockImplementation(({ body }: { body: object }) =>
			Promise.resolve({ ...draft, ...body })
		)
	mocks.savePending = false
})
afterEach(cleanup)

describe.each(['create', 'edit'] as const)(
	'GitHub metadata in the %s form',
	(mode) => {
		function mount() {
			const view = render(
				mode === 'create' ? (
					<CreateProjectForm />
				) : (
					<EditProjectForm project={draft} />
				)
			)
			if (mode === 'create') {
				change('Name', draft.name)
				change('Repository URL', 'original/tool')
				fireEvent.change(screen.getByLabelText('Status'), {
					target: { value: 'draft' },
				})
			}
			return view
		}
		function save() {
			fireEvent.click(
				screen.getByRole('button', {
					name: mode === 'create' ? 'Submit' : 'Save Draft',
				})
			)
		}
		it('fetches only on click, defaults blank fields to selected, applies locally and persists only through Save', async () => {
			mount()
			change('Description', ' \n ')
			change('Website URL', '   ')
			change('Tagline', 'Keep this tagline')
			fireEvent.click(screen.getByRole('button', { name: 'Upload test logo' }))
			fireEvent.click(
				screen.getByRole('button', { name: 'Upload test screenshot' })
			)
			expect(mocks.fetch).not.toHaveBeenCalled()
			const dialog = await fetchPreview()
			expect(dialog.getByRole('link').getAttribute('href')).toBe(
				metadata.repositoryUrl
			)
			expect(
				dialog
					.getByRole('checkbox', { name: 'Apply description' })
					.getAttribute('aria-checked')
			).toBe('true')
			expect(
				dialog
					.getByRole('checkbox', { name: 'Apply website' })
					.getAttribute('aria-checked')
			).toBe('true')
			expect(screen.getByLabelText('Description')).toHaveProperty(
				'value',
				' \n '
			)
			fireEvent.click(dialog.getByRole('button', { name: 'Apply selected' }))
			await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
			expect(screen.getByLabelText('Description')).toHaveProperty(
				'value',
				metadata.description
			)
			expect(screen.getByLabelText('Website URL')).toHaveProperty(
				'value',
				metadata.websiteUrl
			)
			expect(screen.getByLabelText('Repository URL')).toHaveProperty(
				'value',
				'original/tool'
			)
			expect(screen.getByLabelText('Tagline')).toHaveProperty(
				'value',
				'Keep this tagline'
			)
			expect(
				screen.getByText(metadata.description!, { selector: 'p' })
			).toBeTruthy()
			expect(mocks.save).not.toHaveBeenCalled()
			save()
			await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1))
			expect(mocks.save.mock.calls[0]?.[0]).toMatchObject({
				body: {
					description: metadata.description,
					websiteUrl: metadata.websiteUrl,
					repositoryUrl: 'original/tool',
					name: draft.name,
					slug: draft.slug,
					tagline: 'Keep this tagline',
					status: 'draft',
					logo: 'tmp/logos/metadata-1.png',
					screenshot: 'tmp/screenshots/metadata-1.png',
					categorySlugs: [],
				},
			})
		})
		it('leaves populated fields unselected and replaces only the explicitly selected field', async () => {
			mount()
			change('Description', 'My description')
			change('Website URL', 'https://mine.example.com')
			const dialog = await fetchPreview()
			expect(
				dialog
					.getByRole('checkbox', { name: 'Apply description' })
					.getAttribute('aria-checked')
			).toBe('false')
			expect(
				dialog
					.getByRole('checkbox', { name: 'Apply website' })
					.getAttribute('aria-checked')
			).toBe('false')
			expect(
				dialog.getByRole('button', { name: 'Apply selected' })
			).toHaveProperty('disabled', true)
			fireEvent.click(
				dialog.getByRole('checkbox', { name: 'Apply description' })
			)
			fireEvent.click(dialog.getByRole('button', { name: 'Apply selected' }))
			await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
			expect(screen.getByLabelText('Description')).toHaveProperty(
				'value',
				metadata.description
			)
			expect(screen.getByLabelText('Website URL')).toHaveProperty(
				'value',
				'https://mine.example.com'
			)
			expect(mocks.save).not.toHaveBeenCalled()
		})
		it('Cancel and closing the dialog leave all values untouched', async () => {
			mount()
			change('Description', 'My description')
			let dialog = await fetchPreview()
			change('Description suggestion', 'Edited suggestion')
			fireEvent.click(
				dialog.getByRole('checkbox', { name: 'Apply description' })
			)
			fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }))
			await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
			expect(screen.getByLabelText('Description')).toHaveProperty(
				'value',
				'My description'
			)
			dialog = await fetchPreview()
			fireEvent.click(dialog.getByRole('button', { name: 'Close' }))
			await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
			expect(screen.getByLabelText('Description')).toHaveProperty(
				'value',
				'My description'
			)
			expect(mocks.save).not.toHaveBeenCalled()
		})
		it('keeps long descriptions intact and validates editable selected suggestions before Apply', async () => {
			mocks.fetch.mockResolvedValue({
				...metadata,
				description: 'x'.repeat(301),
			})
			mount()
			const dialog = await fetchPreview()
			expect(dialog.getByLabelText('Description suggestion')).toHaveProperty(
				'value',
				'x'.repeat(301)
			)
			expect(dialog.getByText('301/300 characters')).toBeTruthy()
			expect(dialog.getByText(/Description must be 300/)).toBeTruthy()
			expect(
				dialog.getByRole('button', { name: 'Apply selected' })
			).toHaveProperty('disabled', true)
			change('Description suggestion', 'x'.repeat(300))
			change('Website suggestion', 'example.com')
			expect(
				dialog.getByRole('button', { name: 'Apply selected' })
			).toHaveProperty('disabled', true)
			expect(dialog.getByText(/Enter a valid HTTP/)).toBeTruthy()
			change('Website suggestion', ' https://edited.example.com ')
			fireEvent.click(dialog.getByRole('button', { name: 'Apply selected' }))
			await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
			expect(screen.getByLabelText('Description')).toHaveProperty(
				'value',
				'x'.repeat(300)
			)
			expect(screen.getByLabelText('Website URL')).toHaveProperty(
				'value',
				'https://edited.example.com'
			)
		})
		it('does not select missing suggestions and permits applying a valid field with an unselected invalid suggestion', async () => {
			mocks.fetch.mockResolvedValue({
				...metadata,
				description: null,
				websiteUrl: null,
			})
			mount()
			const dialog = await fetchPreview()
			for (const checkbox of dialog.getAllByRole('checkbox')) {
				expect(checkbox.getAttribute('aria-checked')).toBe('false')
			}
			expect(
				dialog.getByRole('button', { name: 'Apply selected' })
			).toHaveProperty('disabled', true)
			change('Description suggestion', 'x'.repeat(301))
			change('Website suggestion', 'http://manual.example.com')
			fireEvent.click(dialog.getByRole('checkbox', { name: 'Apply website' }))
			fireEvent.click(dialog.getByRole('button', { name: 'Apply selected' }))
			await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
			expect(screen.getByLabelText('Description')).toHaveProperty('value', '')
			expect(screen.getByLabelText('Website URL')).toHaveProperty(
				'value',
				'http://manual.example.com'
			)
		})
		it('disables invalid/pending fetches and supports error retry without losing edits or uploads', async () => {
			mount()
			change('Repository URL', 'invalid')
			expect(
				screen.getByRole('button', { name: 'Fetch from GitHub' })
			).toHaveProperty('disabled', true)
			change('Repository URL', 'original/tool')
			change('Description', 'Keep this edit')
			fireEvent.click(screen.getByRole('button', { name: 'Upload test logo' }))
			const request = deferred()
			mocks.fetch.mockReturnValueOnce(request.promise)
			fireEvent.click(screen.getByRole('button', { name: 'Fetch from GitHub' }))
			expect(
				screen.getByRole('button', { name: 'Fetching from GitHub…' })
			).toHaveProperty('disabled', true)
			await act(async () => {
				request.reject(new Error('GitHub is temporarily rate limited'))
				await request.promise.catch(() => undefined)
			})
			expect(await screen.findByRole('alert')).toHaveProperty(
				'textContent',
				expect.stringContaining('rate limited')
			)
			expect(screen.getByLabelText('Description')).toHaveProperty(
				'value',
				'Keep this edit'
			)
			expect(
				document.querySelector('img[src="https://test.invalid/logo.png"]')
			).toBeTruthy()
			await fetchPreview()
			expect(mocks.fetch).toHaveBeenCalledTimes(2)
		})
		it('ignores stale success and failure after repository changes, including changes back to the original input', async () => {
			mount()
			const oldRequest = deferred()
			mocks.fetch.mockReturnValueOnce(oldRequest.promise)
			fireEvent.click(screen.getByRole('button', { name: 'Fetch from GitHub' }))
			change('Repository URL', 'another/tool')
			expect(
				screen.getByText(/Repository changed. Fetch from GitHub again/)
			).toBeTruthy()
			change('Repository URL', 'original/tool')
			const newest = await fetchPreview()
			await act(async () => {
				oldRequest.resolve({ ...metadata, description: 'Stale description' })
				await oldRequest.promise
			})
			expect(newest.getByLabelText('Description suggestion')).toHaveProperty(
				'value',
				metadata.description
			)
			fireEvent.click(newest.getByRole('button', { name: 'Cancel' }))
			await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
			const failed = deferred()
			mocks.fetch.mockReturnValueOnce(failed.promise)
			fireEvent.click(screen.getByRole('button', { name: 'Fetch from GitHub' }))
			change('Repository URL', 'next/tool')
			await fetchPreview()
			await act(async () => {
				failed.reject(new Error('Old failure'))
				await failed.promise.catch(() => undefined)
			})
			expect(screen.queryByText(/Old failure/)).toBeNull()
			expect(screen.getByRole('dialog')).toBeTruthy()
		})
		it('defaults selection using current values when a request finishes', async () => {
			mount()
			const request = deferred()
			mocks.fetch.mockReturnValueOnce(request.promise)
			fireEvent.click(screen.getByRole('button', { name: 'Fetch from GitHub' }))
			change('Description', 'Typed while fetching')
			await act(async () => {
				request.resolve(metadata)
				await request.promise
			})
			expect(
				screen
					.getByRole('checkbox', { name: 'Apply description' })
					.getAttribute('aria-checked')
			).toBe('false')
		})
		it('discards a pending result after the repository changes until the admin fetches again', async () => {
			mount()
			const request = deferred()
			mocks.fetch.mockReturnValueOnce(request.promise)
			fireEvent.click(screen.getByRole('button', { name: 'Fetch from GitHub' }))
			change('Repository URL', 'changed/tool')
			await act(async () => {
				request.resolve(metadata)
				await request.promise
			})
			expect(screen.queryByRole('dialog')).toBeNull()
			expect(
				screen.getByText(/Repository changed. Fetch from GitHub again/)
			).toBeTruthy()
			expect(screen.getByLabelText('Description')).toHaveProperty('value', '')
			expect(mocks.save).not.toHaveBeenCalled()
		})
		it('disables fetching through the TanStack form submission state', async () => {
			mount()
			const saveRequest = deferred<typeof draft>()
			mocks.save.mockReturnValue(saveRequest.promise)
			save()
			await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1))
			expect(
				screen.getByRole('button', { name: 'Fetch from GitHub' })
			).toHaveProperty('disabled', true)
			expect(mocks.fetch).not.toHaveBeenCalled()
			await act(async () => {
				saveRequest.resolve(draft)
				await saveRequest.promise
			})
		})
		it('disables fetching while the project is saving', () => {
			mocks.savePending = true
			mount()
			expect(
				screen.getByRole('button', { name: 'Fetch from GitHub' })
			).toHaveProperty('disabled', true)
			expect(mocks.fetch).not.toHaveBeenCalled()
		})
		it('keeps incomplete Publish validation and preserves applied fields after a failed save', async () => {
			mount()
			const dialog = await fetchPreview()
			fireEvent.click(dialog.getByRole('button', { name: 'Apply selected' }))
			await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
			mocks.save.mockRejectedValue(
				new Error('Cannot publish: logo is required')
			)
			if (mode === 'create') {
				fireEvent.change(screen.getByLabelText('Status'), {
					target: { value: 'published' },
				})
				save()
			} else fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
			expect(await screen.findByRole('alert')).toHaveProperty(
				'textContent',
				expect.stringContaining('Cannot publish')
			)
			expect(screen.getByLabelText('Description')).toHaveProperty(
				'value',
				metadata.description
			)
			expect(screen.getByLabelText('Website URL')).toHaveProperty(
				'value',
				metadata.websiteUrl
			)
		})
	}
)
