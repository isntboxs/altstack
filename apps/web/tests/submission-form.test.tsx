// @vitest-environment jsdom
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import { SubmissionForm } from '#/features/submissions/components/submission-form'

afterEach(cleanup)
function fill() {
	fireEvent.change(screen.getByLabelText('Project name'), {
		target: { value: '  Review Tool  ' },
	})
	fireEvent.change(screen.getByLabelText('GitHub repository'), {
		target: { value: 'OWNER/Repo.git' },
	})
}

describe('submission form', () => {
	it('shows field errors and keeps invalid inputs', async () => {
		const onSubmit = vi.fn()
		render(<SubmissionForm onSubmit={onSubmit} />)
		fireEvent.change(screen.getByLabelText('Project name'), {
			target: { value: 'a' },
		})
		fireEvent.change(screen.getByLabelText('Website URL (optional)'), {
			target: { value: 'ftp://example.com' },
		})
		fireEvent.click(screen.getByRole('button', { name: 'Submit project' }))
		await waitFor(() =>
			expect(
				screen.getByLabelText('Project name').getAttribute('aria-invalid')
			).toBe('true')
		)
		expect(screen.getByText('Name must be at least 2 characters')).toBeTruthy()
		expect(
			screen
				.getByLabelText('Website URL (optional)')
				.getAttribute('aria-invalid')
		).toBe('true')
		expect(screen.getByLabelText('Project name')).toHaveProperty('value', 'a')
		expect(onSubmit).not.toHaveBeenCalled()
	})
	it('shows loading, canonical input, success and resets only after success', async () => {
		let resolve: () => void = () => undefined
		const onSubmit = vi.fn(
			() =>
				new Promise<void>((done) => {
					resolve = done
				})
		)
		render(<SubmissionForm onSubmit={onSubmit} />)
		fill()
		fireEvent.click(screen.getByRole('button', { name: 'Submit project' }))
		await waitFor(() =>
			expect(screen.getByRole('button', { name: /Submitting/ })).toHaveProperty(
				'disabled',
				true
			)
		)
		expect(onSubmit).toHaveBeenCalledWith({
			name: 'Review Tool',
			repositoryUrl: 'https://github.com/owner/repo',
			websiteUrl: undefined,
		})
		expect(screen.getByLabelText('Project name')).toHaveProperty(
			'value',
			'  Review Tool  '
		)
		resolve()
		await waitFor(() =>
			expect(screen.getByRole('status').textContent).toContain(
				'awaiting review'
			)
		)
		expect(screen.getByLabelText('Project name')).toHaveProperty('value', '')
		expect(screen.getByLabelText('GitHub repository')).toHaveProperty(
			'value',
			''
		)
	})
	it('preserves all input after a server failure and supports retry', async () => {
		const onSubmit = vi
			.fn()
			.mockRejectedValueOnce(new Error('Repository already submitted'))
			.mockResolvedValueOnce(undefined)
		render(<SubmissionForm onSubmit={onSubmit} />)
		fill()
		fireEvent.change(screen.getByLabelText('Website URL (optional)'), {
			target: { value: 'https://example.com' },
		})
		fireEvent.click(screen.getByRole('button', { name: 'Submit project' }))
		await waitFor(() =>
			expect(screen.getByRole('alert').textContent).toBe(
				'Repository already submitted'
			)
		)
		expect(screen.getByLabelText('Project name')).toHaveProperty(
			'value',
			'  Review Tool  '
		)
		expect(screen.getByLabelText('GitHub repository')).toHaveProperty(
			'value',
			'OWNER/Repo.git'
		)
		expect(screen.getByLabelText('Website URL (optional)')).toHaveProperty(
			'value',
			'https://example.com'
		)
		fireEvent.click(screen.getByRole('button', { name: 'Submit project' }))
		await waitFor(() => expect(screen.getByRole('status')).toBeTruthy())
		expect(onSubmit).toHaveBeenCalledTimes(2)
		expect(screen.queryByRole('alert')).toBeNull()
	})
	it('preserves a duplicate submission after an earlier success reset', async () => {
		const onSubmit = vi
			.fn()
			.mockResolvedValueOnce(undefined)
			.mockRejectedValueOnce(new Error('Repository already submitted'))
		render(<SubmissionForm onSubmit={onSubmit} />)
		fill()
		fireEvent.click(screen.getByRole('button', { name: 'Submit project' }))
		await waitFor(() => expect(screen.getByRole('status')).toBeTruthy())
		fill()
		fireEvent.click(screen.getByRole('button', { name: 'Submit project' }))
		await waitFor(() =>
			expect(screen.getByRole('alert').textContent).toBe(
				'Repository already submitted'
			)
		)
		expect(screen.getByLabelText('GitHub repository')).toHaveProperty(
			'value',
			'OWNER/Repo.git'
		)
		expect(onSubmit).toHaveBeenCalledTimes(2)
	})
	it('clears validation from earlier fields when completing the form and submitting with Enter', async () => {
		const onSubmit = vi.fn().mockResolvedValue(undefined)
		render(<SubmissionForm onSubmit={onSubmit} />)
		const name = screen.getByLabelText('Project name')
		fireEvent.change(name, { target: { value: 'Review Tool' } })
		fireEvent.blur(name)
		fireEvent.change(screen.getByLabelText('GitHub repository'), {
			target: { value: 'review/example' },
		})
		const form = name.closest('form')
		if (!form) throw new Error('Missing submission form')
		fireEvent.submit(form)
		await waitFor(() => expect(screen.getByRole('status')).toBeTruthy())
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({
				repositoryUrl: 'https://github.com/review/example',
			})
		)
	})
})
