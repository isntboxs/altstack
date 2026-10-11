import { cleanup, fireEvent, render, screen } from '@testing-library/react'
// @vitest-environment jsdom
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import { SubmissionDataTable } from '#/features/submissions/components/submission-data-table'

vi.mock('@tanstack/react-router', () => {
	return {
		Link: ({
			to,
			children,
			...props
		}: ComponentProps<'a'> & { to: string }) => (
			<a href={to} {...props}>
				{children}
			</a>
		),
	}
})
vi.mock('@altstack/env/web', () => {
	return {
		env: { VITE_S3_PUBLIC_URL: 'https://storage.test' },
	}
})
afterEach(cleanup)

type Data = ComponentProps<typeof SubmissionDataTable>['data']
const row = (
	id: string,
	status: Data['submissions'][number]['status'] = 'draft'
): Data['submissions'][number] => {
	return {
		id,
		name: id,
		slug: id.toLowerCase(),
		logo: null,
		repositoryUrl: `https://github.com/example/${id}`,
		status,
		rejectionReason: status === 'rejected' ? 'Repository is archived.' : null,
		createdAt: new Date('2026-10-08T00:00:00Z'),
	}
}
const data = (
	submissions: Data['submissions'],
	page = 1,
	totalItems = submissions.length
): Data => {
	return {
		submissions,
		pagination: {
			page,
			limit: 10,
			totalItems,
			totalPages: Math.ceil(totalItems / 10),
			hasNextPage: page * 10 < totalItems,
			hasPreviousPage: page > 1,
		},
	}
}
const callbacks = () => {
	return {
		onQueryChange: vi.fn<(query: string) => void>(),
		onPageChange: vi.fn<(page: number) => void>(),
		onPageSizeChange: vi.fn<(limit: number) => void>(),
	}
}

describe('owner submission table', () => {
	it('offers submission creation and disabled pagination for an empty list', () => {
		render(<SubmissionDataTable data={data([])} query="" {...callbacks()} />)
		expect(
			screen.getByText('No submissions yet. Submit a project to get started.')
		).toBeTruthy()
		expect(
			screen
				.getByRole('button', { name: 'Submit a project' })
				.getAttribute('href')
		).toBe('/submit')
		expect(screen.getByText('Page 1 of 1')).toBeTruthy()
		expect(
			screen.getByRole('button', { name: 'Next page' }).hasAttribute('disabled')
		).toBe(true)
	})
	it('renders incomplete drafts and every review status without moderation or draft preview links', () => {
		render(
			<SubmissionDataTable
				data={data([
					row('Draft'),
					row('Live', 'published'),
					row('Rejected', 'rejected'),
					row('Removed', 'removed'),
				])}
				query=""
				{...callbacks()}
			/>
		)
		for (const label of [
			'Awaiting review',
			'Published',
			'Rejected',
			'Removed',
			'Repository is archived.',
		]) {
			expect(screen.getAllByText(label).length).toBeGreaterThan(0)
		}
		expect(document.querySelector('img')).toBeNull()
		expect(
			Array.from(document.querySelectorAll('a')).map((link) =>
				link.getAttribute('href')
			)
		).toEqual([
			'/submit',
			'https://github.com/example/Draft',
			'https://github.com/example/Live',
			'https://github.com/example/Rejected',
			'https://github.com/example/Removed',
		])
		expect(
			screen.queryByRole('button', { name: /Publish|Reject|Edit/ })
		).toBeNull()
	})
	it('sends search and page requests to server-controlled navigation', () => {
		const props = callbacks()
		render(
			<SubmissionDataTable
				data={data([row('Alpha')], 2, 31)}
				query="alpha"
				{...props}
			/>
		)
		fireEvent.change(
			screen.getByRole('textbox', { name: 'Search submissions' }),
			{ target: { value: 'beta' } }
		)
		expect(props.onQueryChange).toHaveBeenCalledWith('beta')
		for (const label of [
			'First page',
			'Previous page',
			'Next page',
			'Last page',
		]) {
			fireEvent.click(screen.getByRole('button', { name: label }))
		}
		expect(props.onPageChange.mock.calls.map(([page]) => page)).toEqual([
			1, 1, 3, 4,
		])
		fireEvent.click(
			screen.getByRole('combobox', { name: 'Submissions per page' })
		)
		fireEvent.pointerDown(screen.getByRole('option', { name: '25' }))
		fireEvent.click(screen.getByRole('option', { name: '25' }))
		expect(props.onPageSizeChange).toHaveBeenCalledWith(25)
	})
	it('keeps selected row identity when another page replaces the rows', () => {
		const props = callbacks()
		const view = render(
			<SubmissionDataTable
				data={data([row('Alpha')], 1, 20)}
				query=""
				{...props}
			/>
		)
		fireEvent.click(screen.getByRole('checkbox', { name: 'Select Alpha' }))
		view.rerender(
			<SubmissionDataTable
				data={data([row('Beta')], 2, 20)}
				query=""
				{...props}
			/>
		)
		expect(
			screen
				.getByRole('checkbox', { name: 'Select Beta' })
				.getAttribute('aria-checked')
		).toBe('false')
		expect(screen.getByText('1 of 20 row(s) selected.')).toBeTruthy()
		view.rerender(
			<SubmissionDataTable
				data={data([row('Alpha')], 1, 20)}
				query=""
				{...props}
			/>
		)
		expect(
			screen
				.getByRole('checkbox', { name: 'Select Alpha' })
				.getAttribute('aria-checked')
		).toBe('true')
	})
	it('distinguishes search misses from an empty out-of-range page', () => {
		const props = callbacks()
		const view = render(
			<SubmissionDataTable data={data([])} query="unknown" {...props} />
		)
		expect(screen.getByText('No submissions match your search.')).toBeTruthy()
		view.rerender(
			<SubmissionDataTable data={data([], 3, 1)} query="" {...props} />
		)
		expect(
			screen.getByText('No submissions on this page. Try an earlier page.')
		).toBeTruthy()
		expect(
			screen
				.getByRole('button', { name: 'Previous page' })
				.hasAttribute('disabled')
		).toBe(false)
	})
})
