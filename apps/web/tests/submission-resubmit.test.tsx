// @vitest-environment jsdom
import { ORPCError } from '@orpc/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type * as RouterModule from '@tanstack/react-router'
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { ORPCRouterClient } from '@altstack/api/routers'

import { ResubmitSubmissionDialog } from '#/features/submissions/components/resubmit-submission-dialog'
import { submissionQueries } from '#/features/submissions/queries'
import { orpc } from '#/utils/orpc'

const { rpc, invalidateRouter } = vi.hoisted(() => {
	return {
		rpc: vi.fn<(path: Array<string>, input: unknown) => Promise<unknown>>(),
		invalidateRouter: vi.fn(),
	}
})
vi.mock('@tanstack/react-router', async () => {
	const actual = await vi.importActual<typeof RouterModule>(
		'@tanstack/react-router'
	)
	return {
		...actual,
		useRouter: () => {
			return { invalidate: invalidateRouter }
		},
	}
})
vi.mock('#/utils/orpc', async () => {
	const { createORPCClient } = await import('@orpc/client')
	const { createTanstackQueryUtils } = await import('@orpc/tanstack-query')
	return {
		orpc: createTanstackQueryUtils(
			createORPCClient<ORPCRouterClient>({ call: rpc })
		),
	}
})
const id = '550e8400-e29b-41d4-a716-446655440000'
const intake = {
	id,
	name: 'Original Tool',
	repositoryUrl: 'https://github.com/example/tool',
	websiteUrl: 'https://original.example.com',
	status: 'rejected',
	rejectionReason: 'Correct the name and website.',
	revision: '123',
}
let queryClient: QueryClient
beforeEach(() => {
	queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	})
	rpc
		.mockReset()
		.mockImplementation((path) =>
			Promise.resolve(
				path.at(-1) === 'getById' ? intake : { id, status: 'draft' }
			)
		)
	invalidateRouter.mockReset().mockResolvedValue(undefined)
})
afterEach(() => {
	cleanup()
	queryClient.clear()
	vi.useRealTimers()
})
function view() {
	const onClose = vi.fn()
	const onSuccess = vi.fn()
	const rendered = render(
		<QueryClientProvider client={queryClient}>
			<ResubmitSubmissionDialog
				id={id}
				userId="submitter"
				onClose={onClose}
				onSuccess={onSuccess}
			/>
		</QueryClientProvider>
	)
	return { ...rendered, onClose, onSuccess }
}
async function ready() {
	await screen.findByLabelText('Project name')
}
describe('private Edit & Resubmit dialog', () => {
	it('reads fresh feedback and revision when reopened without a duplicate read on reveal', async () => {
		const first = view()
		await ready()
		expect(rpc).toHaveBeenCalledTimes(1)
		first.unmount()
		rpc.mockResolvedValueOnce({
			...intake,
			revision: '456',
			rejectionReason: 'Updated review feedback.',
		})
		const second = view()
		await ready()
		expect(screen.getByText('Updated review feedback.')).toBeTruthy()
		expect(rpc).toHaveBeenCalledTimes(2)
		fireEvent.click(screen.getByRole('button', { name: 'Resubmit project' }))
		await waitFor(() => expect(second.onSuccess).toHaveBeenCalledTimes(1))
		expect(
			rpc.mock.calls.find(
				([path]) => path.join('/') === 'submission/resubmit'
			)?.[1]
		).toMatchObject({ params: { id }, body: { revision: '456' } })
	})
	it('prefills intake and private feedback, sends only allowed fields/revision and refreshes the table route in place', async () => {
		const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
		const { onSuccess } = view()
		await ready()
		expect(screen.getByRole('dialog', { name: 'Edit & Resubmit' })).toBeTruthy()
		expect(screen.getByText(intake.rejectionReason)).toBeTruthy()
		for (const [label, value] of [
			['Project name', intake.name],
			['GitHub repository', intake.repositoryUrl],
			['Website URL (optional)', intake.websiteUrl],
		]) {
			expect(screen.getByLabelText(label)).toHaveProperty('value', value)
		}
		fireEvent.change(screen.getByLabelText('Project name'), {
			target: { value: ' Corrected Tool ' },
		})
		fireEvent.change(screen.getByLabelText('GitHub repository'), {
			target: { value: 'EXAMPLE/Tool.git' },
		})
		fireEvent.change(screen.getByLabelText('Website URL (optional)'), {
			target: { value: '' },
		})
		fireEvent.click(screen.getByRole('button', { name: 'Resubmit project' }))
		await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
		expect(rpc).toHaveBeenCalledWith(
			['submission', 'resubmit'],
			{
				params: { id },
				body: {
					name: 'Corrected Tool',
					repositoryUrl: intake.repositoryUrl,
					websiteUrl: undefined,
					revision: '123',
				},
			},
			expect.anything()
		)
		expect(invalidate).toHaveBeenCalledWith({
			queryKey: orpc.submission.list.key(),
		})
		expect(invalidateRouter).toHaveBeenCalledWith({ sync: true })
	})
	it('keeps private cache keys separate between accounts', () => {
		expect(submissionQueries.getById(id, 'first').queryKey).not.toEqual(
			submissionQueries.getById(id, 'second').queryKey
		)
	})
	it('shows loading and private read errors with an explicit retry and no form', async () => {
		const pending = Promise.withResolvers<unknown>()
		rpc.mockImplementationOnce(() => pending.promise)
		view()
		expect(screen.getByRole('status').textContent).toContain('Loading')
		expect(
			screen.queryByRole('button', { name: 'Resubmit project' })
		).toBeNull()
		pending.reject(
			new ORPCError('NOT_FOUND', { message: 'Submission not found' })
		)
		await screen.findByText('Submission not found')
		expect(screen.queryByLabelText('Project name')).toBeNull()
		expect(rpc).toHaveBeenCalledTimes(1)
		fireEvent.click(screen.getByRole('button', { name: 'Retry loading' }))
		await ready()
		expect(rpc).toHaveBeenCalledTimes(2)
	})
	it('renders inline validation and permits correction without losing prefilled feedback', async () => {
		view()
		await ready()
		fireEvent.change(screen.getByLabelText('Project name'), {
			target: { value: 'x' },
		})
		fireEvent.change(screen.getByLabelText('Website URL (optional)'), {
			target: { value: 'ftp://example.com' },
		})
		fireEvent.click(screen.getByRole('button', { name: 'Resubmit project' }))
		await waitFor(() =>
			expect(
				screen.getByLabelText('Project name').getAttribute('aria-invalid')
			).toBe('true')
		)
		expect(rpc).toHaveBeenCalledTimes(1)
		expect(screen.getByText('Name must be at least 2 characters')).toBeTruthy()
		expect(screen.getByText(intake.rejectionReason)).toBeTruthy()
		fireEvent.change(screen.getByLabelText('Project name'), {
			target: { value: 'Corrected' },
		})
		fireEvent.change(screen.getByLabelText('Website URL (optional)'), {
			target: { value: 'https://example.com' },
		})
		fireEvent.click(screen.getByRole('button', { name: 'Resubmit project' }))
		await waitFor(() => expect(invalidateRouter).toHaveBeenCalledTimes(1))
	})
	it.each(['CONFLICT', 'INTERNAL_SERVER_ERROR', 'TOO_MANY_REQUESTS'] as const)(
		'preserves correction and feedback after %s without automatic retry',
		async (code) => {
			rpc
				.mockResolvedValueOnce(intake)
				.mockRejectedValueOnce(
					new ORPCError(code, { message: 'Please correct or retry' })
				)
			const { onSuccess } = view()
			await ready()
			fireEvent.change(screen.getByLabelText('Project name'), {
				target: { value: 'My correction' },
			})
			fireEvent.click(screen.getByRole('button', { name: 'Resubmit project' }))
			await screen.findByText('Please correct or retry')
			expect(screen.getByLabelText('Project name')).toHaveProperty(
				'value',
				'My correction'
			)
			expect(screen.getByText(intake.rejectionReason)).toBeTruthy()
			expect(
				screen.getByRole('button', { name: 'Resubmit project' })
			).toHaveProperty('disabled', false)
			expect(onSuccess).not.toHaveBeenCalled()
			expect(invalidateRouter).not.toHaveBeenCalled()
			expect(rpc).toHaveBeenCalledTimes(2)
		}
	)
	it('blocks close and repeat submission while pending, then returns to the list', async () => {
		const pending = Promise.withResolvers<unknown>()
		rpc
			.mockResolvedValueOnce(intake)
			.mockImplementationOnce(() => pending.promise)
		const { onClose, onSuccess } = view()
		await ready()
		fireEvent.click(screen.getByRole('button', { name: 'Resubmit project' }))
		await screen.findByRole('button', { name: /Resubmitting…/ })
		expect(
			screen.getByLabelText('Project name').closest('fieldset')
		).toHaveProperty('disabled', true)
		await waitFor(() =>
			expect(screen.getByRole('button', { name: 'Cancel' })).toHaveProperty(
				'disabled',
				true
			)
		)
		fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
		expect(onClose).not.toHaveBeenCalled()
		pending.resolve({ id, status: 'draft' })
		await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
	})
	it('shares the countdown behavior, leaves corrections editable and requires an explicit retry', async () => {
		view()
		await ready()
		vi.useFakeTimers()
		vi.setSystemTime(new Date('2026-10-14T12:00:00Z'))
		rpc.mockRejectedValueOnce(
			new ORPCError('TOO_MANY_REQUESTS', {
				data: { limit: 5, remaining: 0, reset: Date.now() + 2_000 },
			})
		)
		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: 'Resubmit project' }))
			await vi.advanceTimersByTimeAsync(1)
		})
		expect(
			screen.getByRole('button', { name: 'Resubmit project' })
		).toHaveProperty('disabled', true)
		fireEvent.change(screen.getByLabelText('Project name'), {
			target: { value: 'Rate limited correction' },
		})
		await act(async () => {
			fireEvent.submit(screen.getByLabelText('Project name').closest('form')!)
			await vi.advanceTimersByTimeAsync(3_000)
		})
		expect(rpc).toHaveBeenCalledTimes(2)
		expect(screen.getByLabelText('Project name')).toHaveProperty(
			'value',
			'Rate limited correction'
		)
		expect(
			screen.getByRole('button', { name: 'Resubmit project' })
		).toHaveProperty('disabled', false)
	})
})
