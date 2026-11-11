import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vite-plus/test'
import { page } from 'vite-plus/test/browser'

import { ThemeProvider } from '@altstack/ui/components/customs/theme-provider'

import BlockNoteEditor from '#/components/block-note/editor'
import type { BlockNoteEditorHandle } from '#/components/block-note/editor'
import type { ContentEditor } from '#/components/block-note/schema'
import { canSaveEditorContent } from '#/components/block-note/upload-image'
import { PublicContent } from '#/components/public-content'
import '#/styles.css'

const { request, complete } = vi.hoisted(() => {
	return {
		request: vi.fn(),
		complete: vi.fn(),
	}
})
vi.mock('#/utils/orpc', () => {
	return {
		client: { contentImageUpload: { request, complete } },
	}
})
vi.mock('@altstack/ui/components/toast', () => {
	return { toast: { add: vi.fn() } }
})
vi.mock('#/features/public-content/server-function', () => {
	return {
		preparePublicContent: vi.fn(),
	}
})
vi.mock('@altstack/env/web', () => {
	return {
		env: {
			VITE_APP_URL: 'https://app.test',
			VITE_S3_PUBLIC_URL: 'https://cdn.test',
		},
	}
})
vi.mock('#/components/block-note/project-mention-menu', () => {
	return {
		ProjectMentionMenus: ({ editor }: { editor: ContentEditor }) => (
			<button
				type="button"
				onClick={() =>
					editor.insertBlocks([{ type: 'image' }], editor.document[0], 'after')
				}
			>
				Insert test image block
			</button>
		),
	}
})

beforeEach(() => {
	vi.resetAllMocks()
	request.mockResolvedValue({
		key: 'tmp/content-images/test.png',
		presignedUrl: 'https://s3.test/signed',
	})
	const originalFetch = globalThis.fetch
	vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
		if (input === 'https://s3.test/signed') {
			return Promise.resolve(new Response(null, { status: 200 }))
		}
		return originalFetch(input, init)
	})
})
afterEach(() => {
	cleanup()
	vi.restoreAllMocks()
	document.documentElement.classList.remove('dark')
})

it.each([
	[390, 'light'],
	[1440, 'dark'],
] as const)(
	'uploads through the real BlockNote file panel and renders saved Markdown at %ipx in %s mode',
	async (width, theme) => {
		await page.viewport(width, 900)
		localStorage.setItem('content-image-theme', theme)
		const ref = createRef<BlockNoteEditorHandle>()
		render(
			<ThemeProvider defaultTheme={theme} storageKey="content-image-theme">
				<BlockNoteEditor ref={ref} value="Image upload test" />
			</ThemeProvider>
		)
		await page.getByRole('button', { name: 'Insert test image block' }).click()
		await page.getByText('Add image', { exact: true }).click()
		await page.getByRole('tab', { name: 'Upload', exact: true }).click()
		const input =
			document.querySelector<HTMLInputElement>('input[type="file"]')!
		expect(input).toBeTruthy()
		let finish!: (value: { url: string }) => void
		complete.mockImplementation(
			() =>
				new Promise((resolve) => {
					finish = resolve
				})
		)
		const bytes = Uint8Array.from(
			atob(
				'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6EJkAAAAASUVORK5CYII='
			),
			(char) => char.charCodeAt(0)
		)
		const file = new File([bytes], 'diagram.png', { type: 'image/png' })
		const transfer = new DataTransfer()
		transfer.items.add(file)
		input.files = transfer.files
		fireEvent.change(input)
		await waitFor(() => expect(complete).toHaveBeenCalled())
		expect(canSaveEditorContent(ref.current)).toBe(false)
		const url = new URL('/og/default.png', window.location.href).href
		finish({ url })
		await waitFor(() =>
			expect(
				document.querySelector('.bn-editor img')?.getAttribute('src')
			).toBe(url)
		)
		expect(canSaveEditorContent(ref.current)).toBe(true)
		const markdown = ref.current!.readMarkdown()
		expect(markdown).toContain(url)
		expect(markdown).not.toContain('tmp/content-images')
		cleanup()
		render(<PublicContent slug="image-test" content={markdown} />)
		const image = screen.getByRole('img') as HTMLImageElement
		await waitFor(() => expect(image.naturalWidth).toBeGreaterThan(0))
		expect(image.getBoundingClientRect().width).toBeLessThanOrEqual(width)
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width)
	}
)
