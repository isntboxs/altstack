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

import type { ORPCRouterInputs, ORPCRouterOutputs } from '@altstack/api/routers'

import type { BlockNoteEditorHandle } from '#/components/block-note/editor'
import { EditProjectForm } from '#/routes/_main/projects/$id.edit'
import { CreateProjectForm } from '#/routes/_main/projects/create'

type Metadata = ORPCRouterOutputs['admin']['project']['githubReadme']
const mocks = vi.hoisted(() => {
	return {
		fetch: vi.fn<() => Promise<Metadata>>(),
		save: vi.fn<
			(input: {
				body: NonNullable<
					ORPCRouterInputs['admin']['project']['update']['body']
				>
			}) => Promise<ORPCRouterOutputs['admin']['project']['getById']>
		>(),
		savePending: false,
	}
})
vi.mock('#/features/admin-projects/queries', () => {
	return {
		useAdminProjectGithubReadme: () => {
			return { mutateAsync: mocks.fetch }
		},
		useAdminProjectGithubMetadata: () => {
			return { mutateAsync: vi.fn() }
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
vi.mock('#/components/block-note/view', () => {
	return {
		BlockNoteViewBlocks: ({
			blocks,
		}: {
			blocks: Array<{ content?: string }>
		}) => <pre>{blocks.map((block) => block.content).join('\n\n')}</pre>,
	}
})
vi.mock('#/components/block-note/editor', async () => {
	const { useRef, useImperativeHandle } = await import('react')
	return {
		default: function TestEditor({
			value,
			onChange,
			ref,
		}: {
			value?: string
			onChange: (value: string) => void
			ref: React.Ref<BlockNoteEditorHandle>
		}) {
			const content = useRef(value ?? '')
			const pending = useRef(false)
			useImperativeHandle(ref, () => {
				const flush = () => {
					if (pending.current) {
						pending.current = false
						onChange(content.current)
					}
				}
				const preview = (markdown: string, mode: string) => {
					flush()
					if (!markdown.trim()) {
						throw new Error('README has no supported content')
					}
					const next =
						mode === 'append' && content.current.trim()
							? content.current + '\n\n' + markdown
							: markdown
					return {
						markdown: next,
						blocks: [{ type: 'paragraph' as const, content: next }],
					}
				}
				return {
					flush,
					readMarkdown: () => {
						flush()
						return content.current
					},
					previewImport: preview,
					importMarkdown: (markdown, mode, expected) => {
						const next = preview(markdown, mode)
						if (next.markdown !== expected) return { ...next, applied: false }
						content.current = next.markdown
						onChange(content.current)
						return { ...next, applied: true }
					},
				}
			}, [onChange])
			return (
				<textarea
					aria-label="Test content editor"
					defaultValue={content.current}
					onChange={(event) => {
						content.current = event.target.value
						pending.current = true
					}}
				/>
			)
		},
	}
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
	},
}
const metadata: Metadata = {
	repositoryUrl: 'https://github.com/resolved/tool',
	sourceUrl:
		'https://github.com/resolved/tool/blob/0123456789abcdef0123456789abcdef01234567/README.md',
	path: 'README.md',
	commitSha: '0123456789abcdef0123456789abcdef01234567',
	markdown: '# Imported README',
	warnings: ['Custom HTML alignment was removed.'],
}
function change(label: string, value: string) {
	fireEvent.change(screen.getByLabelText(label), { target: { value } })
}
async function fetchPreview() {
	fireEvent.click(screen.getByRole('button', { name: 'Import README' }))
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
	mocks.save.mockReset().mockResolvedValue(draft)
	mocks.savePending = false
})
afterEach(cleanup)

describe.each(['create', 'edit'] as const)(
	'README import in the %s form',
	(mode) => {
		function mount() {
			render(
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
		}
		function save() {
			fireEvent.click(
				screen.getByRole('button', {
					name: mode === 'create' ? 'Submit' : 'Save Draft',
				})
			)
		}
		it('defaults empty content to Replace, shows warnings and pinned source, applies locally and saves only through Save', async () => {
			mount()
			change('Tagline', 'Keep tagline')
			change('Description', 'Keep description')
			fireEvent.click(screen.getByRole('button', { name: 'Upload test logo' }))
			fireEvent.click(
				screen.getByRole('button', { name: 'Upload test screenshot' })
			)
			expect(mocks.fetch).not.toHaveBeenCalled()
			const dialog = await fetchPreview()
			expect(
				dialog.getByRole('radio', { name: 'Replace content' })
			).toHaveProperty('checked', true)
			expect(dialog.getByText(metadata.warnings[0])).toBeTruthy()
			expect(dialog.getByRole('link')).toHaveProperty(
				'href',
				metadata.sourceUrl
			)
			expect(
				dialog.getByRole('region', { name: 'README content preview' })
					.textContent
			).toContain(metadata.markdown)
			fireEvent.click(dialog.getByRole('button', { name: 'Apply README' }))
			await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
			expect(mocks.save).not.toHaveBeenCalled()
			save()
			await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1))
			expect(mocks.save.mock.calls[0]?.[0].body).toMatchObject({
				content: metadata.markdown,
				tagline: 'Keep tagline',
				description: 'Keep description',
				repositoryUrl: 'original/tool',
				logo: 'tmp/logos/metadata-1.png',
				screenshot: 'tmp/screenshots/metadata-1.png',
				status: 'draft',
			})
		})
		it.each(['replace', 'append'] as const)(
			'requires an explicit mode for existing content and previews/applies %s',
			async (action) => {
				mount()
				change('Test content editor', 'Latest original edit')
				const dialog = await fetchPreview()
				expect(
					dialog.getByRole('button', { name: 'Apply README' })
				).toHaveProperty('disabled', true)
				expect(
					dialog.getByRole('radio', { name: 'Replace content' })
				).toHaveProperty('checked', false)
				fireEvent.click(
					dialog.getByRole('radio', {
						name:
							action === 'replace' ? 'Replace content' : 'Append to content',
					})
				)
				const expected =
					action === 'replace'
						? metadata.markdown
						: 'Latest original edit\n\n' + metadata.markdown
				expect(dialog.getByRole('region').textContent).toBe(expected)
				fireEvent.click(dialog.getByRole('button', { name: 'Apply README' }))
				save()
				await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1))
				expect(mocks.save.mock.calls[0]?.[0].body.content).toBe(expected)
			}
		)
		it('Cancel preserves content and uploads without saving', async () => {
			mount()
			change('Test content editor', 'Keep this content')
			fireEvent.click(screen.getByRole('button', { name: 'Upload test logo' }))
			const dialog = await fetchPreview()
			fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }))
			expect(mocks.save).not.toHaveBeenCalled()
			save()
			await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1))
			expect(mocks.save.mock.calls[0]?.[0].body).toMatchObject({
				content: 'Keep this content',
				logo: 'tmp/logos/metadata-1.png',
			})
		})
		it('uses edits made while fetching and refreshes preview for newer edits before Apply', async () => {
			mount()
			const request = deferred()
			mocks.fetch.mockReturnValueOnce(request.promise)
			fireEvent.click(screen.getByRole('button', { name: 'Import README' }))
			change('Test content editor', 'While fetching')
			await act(async () => {
				request.resolve(metadata)
				await request.promise
			})
			const dialog = within(screen.getByRole('dialog'))
			fireEvent.click(dialog.getByRole('radio', { name: 'Append to content' }))
			change('Test content editor', 'Last keystroke')
			fireEvent.click(dialog.getByRole('button', { name: 'Apply README' }))
			expect(dialog.getByRole('region').textContent).toBe(
				'Last keystroke\n\n' + metadata.markdown
			)
			expect(dialog.getByText(/Content changed/)).toBeTruthy()
			expect(mocks.save).not.toHaveBeenCalled()
			fireEvent.click(dialog.getByRole('button', { name: 'Apply README' }))
			save()
			await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1))
			expect(mocks.save.mock.calls[0]?.[0].body.content).toBe(
				'Last keystroke\n\n' + metadata.markdown
			)
		})
		it('discards stale success/failure and an open preview after repository changes, including changes back', async () => {
			mount()
			const request = deferred()
			mocks.fetch.mockReturnValueOnce(request.promise)
			fireEvent.click(screen.getByRole('button', { name: 'Import README' }))
			change('Repository URL', 'changed/tool')
			change('Repository URL', 'original/tool')
			await act(async () => {
				request.resolve(metadata)
				await request.promise
			})
			expect(screen.queryByRole('dialog')).toBeNull()
			const failed = deferred()
			mocks.fetch.mockReturnValueOnce(failed.promise)
			fireEvent.click(screen.getByRole('button', { name: 'Import README' }))
			change('Repository URL', 'newest/tool')
			await fetchPreview()
			await act(async () => {
				failed.reject(new Error('Stale error'))
				await failed.promise.catch(() => undefined)
			})
			expect(screen.queryByText(/Stale error/)).toBeNull()
			change('Repository URL', 'other/tool')
			expect(screen.queryByRole('dialog')).toBeNull()
			expect(mocks.save).not.toHaveBeenCalled()
		})
		it('preserves content and uploads through loading/error/retry and empty conversion', async () => {
			mount()
			change('Test content editor', 'Keep edit')
			fireEvent.click(screen.getByRole('button', { name: 'Upload test logo' }))
			const request = deferred()
			mocks.fetch.mockReturnValueOnce(request.promise)
			fireEvent.click(screen.getByRole('button', { name: 'Import README' }))
			expect(
				screen.getByRole('button', { name: /Fetching README/ })
			).toHaveProperty('disabled', true)
			await act(async () => {
				request.reject(new Error('Rate limited'))
				await request.promise.catch(() => undefined)
			})
			expect(await screen.findByRole('alert')).toHaveProperty(
				'textContent',
				expect.stringContaining('Rate limited')
			)
			mocks.fetch.mockResolvedValueOnce({ ...metadata, markdown: '' })
			fireEvent.click(screen.getByRole('button', { name: 'Import README' }))
			await waitFor(() =>
				expect(screen.getByRole('alert').textContent).toContain(
					'no supported content'
				)
			)
			const dialog = await fetchPreview()
			fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }))
			save()
			await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1))
			expect(mocks.save.mock.calls[0]?.[0].body).toMatchObject({
				content: 'Keep edit',
				logo: 'tmp/logos/metadata-1.png',
			})
		})
		it('disables invalid repositories and saving, including TanStack submission state', async () => {
			mount()
			change('Repository URL', 'invalid')
			expect(
				screen.getByRole('button', { name: 'Import README' })
			).toHaveProperty('disabled', true)
			change('Repository URL', 'original/tool')
			const request = deferred<typeof draft>()
			mocks.save.mockReturnValueOnce(request.promise)
			save()
			await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1))
			expect(
				screen.getByRole('button', { name: 'Import README' })
			).toHaveProperty('disabled', true)
			await act(async () => {
				request.resolve(draft)
				await request.promise
			})
		})
		it('disables while the save mutation is pending', () => {
			mocks.savePending = true
			mount()
			expect(
				screen.getByRole('button', { name: 'Import README' })
			).toHaveProperty('disabled', true)
		})
		it('flushes the same-task last keystroke before Save without importing', async () => {
			mount()
			change('Test content editor', 'Final keystroke')
			save()
			await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1))
			expect(mocks.save.mock.calls[0]?.[0].body.content).toBe('Final keystroke')
		})
	}
)
