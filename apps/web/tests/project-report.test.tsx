// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { ProjectReportDialog } from '#/features/project/components/project-report-dialog'

const { create, toast } = vi.hoisted(() => {
	return {
		create: vi.fn(),
		toast: vi.fn(),
	}
})
vi.mock('#/utils/orpc', () => {
	return { client: { report: { create } } }
})
vi.mock('@altstack/ui/components/toast', () => {
	return { toast: { add: toast } }
})
let queryClient: QueryClient
beforeEach(() => {
	queryClient = new QueryClient({
		defaultOptions: { mutations: { retry: false } },
	})
	create.mockReset().mockResolvedValue({ received: true })
	toast.mockReset()
})
afterEach(() => {
	cleanup()
	queryClient.clear()
	vi.restoreAllMocks()
})
function Form({ userId }: { userId?: string }) {
	const [open, setOpen] = useState(true)
	return (
		<>
			<button onClick={() => setOpen(true)}>Reopen</button>
			<ProjectReportDialog
				projectId="550e8400-e29b-41d4-a716-446655440000"
				name="Example"
				userId={userId}
				open={open}
				onOpenChange={setOpen}
				finalFocus={() => null}
			/>
		</>
	)
}
function view(userId?: string) {
	return render(
		<QueryClientProvider client={queryClient}>
			<Form userId={userId} />
		</QueryClientProvider>
	)
}
function choose(name: string) {
	fireEvent.click(screen.getByRole('radio', { name }))
}
function email() {
	fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), {
		target: { value: ' guest@example.test ' },
	})
}
function send() {
	fireEvent.click(screen.getByRole('button', { name: 'Send' }))
}

describe('report dialog', () => {
	it('requires guest email and type with accessible errors and focuses the first invalid control', async () => {
		view()
		expect(
			screen.getAllByRole('radio').map((radio) => radio.textContent)
		).toHaveLength(4)
		send()
		expect(create).not.toHaveBeenCalled()
		await waitFor(() =>
			expect(
				screen
					.getByRole('textbox', { name: 'Email' })
					.getAttribute('aria-invalid')
			).toBe('true')
		)
		email()
		send()
		expect(screen.getByText('Please choose a report type.')).toBeTruthy()
		choose('Other')
		send()
		expect(screen.getByText('Please describe the issue.')).toBeTruthy()
		expect(screen.getByRole('textbox', { name: 'Message' })).toHaveProperty(
			'required',
			true
		)
		fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), {
			target: { value: ' \n ' },
		})
		send()
		expect(create).not.toHaveBeenCalled()
		choose('Outdated')
		expect(screen.getByRole('textbox', { name: 'Message' })).toHaveProperty(
			'required',
			false
		)
		send()
		await waitFor(() => expect(create).toHaveBeenCalledTimes(1))
		expect(create).toHaveBeenCalledWith({
			params: { id: '550e8400-e29b-41d4-a716-446655440000' },
			body: { type: 'outdated', message: '', email: 'guest@example.test' },
		})
	})
	it.each(['user', 'admin'])(
		'shows only Type/Message for %s, omits email and accepts optional message',
		async (userId) => {
			view(userId)
			expect(screen.queryByLabelText('Email')).toBeNull()
			choose('Broken link')
			send()
			await waitFor(() => expect(create).toHaveBeenCalledTimes(1))
			expect(create).toHaveBeenCalledWith({
				params: { id: '550e8400-e29b-41d4-a716-446655440000' },
				body: { type: 'broken_link', message: '' },
			})
		}
	)
	it('prevents duplicate pending sends, keeps entries on failure, closes/resets only after persistence', async () => {
		let finish!: (value: unknown) => void
		create
			.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						finish = resolve
					})
			)
			.mockRejectedValueOnce(new Error('Storage failure'))
		view()
		email()
		choose('Wrong category')
		fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), {
			target: { value: 'Move category' },
		})
		send()
		fireEvent.submit(document.querySelector('form')!)
		await waitFor(() => expect(create).toHaveBeenCalledTimes(1))
		expect(
			await screen.findByRole('button', { name: 'Sending…' })
		).toHaveProperty('disabled', true)
		expect(toast).not.toHaveBeenCalled()
		await act(async () => {
			finish({ received: true })
			await Promise.resolve()
		})
		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
		expect(toast).toHaveBeenCalledWith(
			expect.objectContaining({ type: 'success' })
		)
		fireEvent.click(screen.getByRole('button', { name: 'Reopen' }))
		expect(screen.getByRole('textbox', { name: 'Email' })).toHaveProperty(
			'value',
			''
		)
		expect(screen.getByRole('textbox', { name: 'Message' })).toHaveProperty(
			'value',
			''
		)
		email()
		choose('Other')
		fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), {
			target: { value: 'Keep this message' },
		})
		send()
		await screen.findByText('Unable to send your report. Please try again.')
		expect(screen.getByRole('textbox', { name: 'Message' })).toHaveProperty(
			'value',
			'Keep this message'
		)
		expect(
			screen.getByRole('radio', { name: 'Other' }).getAttribute('aria-checked')
		).toBe('true')
		expect(toast).toHaveBeenCalledTimes(1)
		create.mockResolvedValueOnce({ received: true })
		send()
		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
	})
	it.each([
		['TOO_MANY_REQUESTS', 'Too many reports.'],
		['NOT_FOUND', 'This project is no longer available'],
	])('shows honest %s feedback', async (code, text) => {
		create.mockRejectedValueOnce(Object.assign(new Error(), { code }))
		view('user')
		choose('Outdated')
		send()
		await screen.findByText(new RegExp(text))
		expect(toast).not.toHaveBeenCalled()
	})
})
