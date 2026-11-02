// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { AdCampaign } from '@altstack/shared/schemas/ads'

import { AdsAdmin } from '#/features/ads/admin-editor'
import { campaign } from './ads-fixtures'
const mock = vi.hoisted(() => {
	return {
		rows: [] as Array<AdCampaign>,
		create: vi.fn(),
		update: vi.fn(),
		remove: vi.fn(),
	}
})
vi.mock('#/utils/orpc', () => {
	return {
		client: {
			admin: {
				ads: { create: mock.create, update: mock.update, delete: mock.remove },
				upload: { screenshot: {} },
			},
		},
		orpc: {
			admin: {
				ads: {
					key: () => ['admin', 'ads'],
					list: {
						queryOptions: () => {
							return {
								queryKey: ['admin', 'ads', 'list'],
								queryFn: () => Promise.resolve(mock.rows),
							}
						},
					},
				},
			},
		},
	}
})
vi.mock('#/features/ads/provider', () => {
	return {
		inventoryOptions: () => {
			return { queryKey: ['ads', 'inventory', ''] }
		},
	}
})
vi.mock('#/components/project-media', () => {
	return { ProjectLogo: () => null }
})
vi.mock('#/utils/storage', () => {
	return {
		resolveFileUrl: (key: string) => `https://assets.test/${key}`,
	}
})
vi.mock('#/components/image-uploader', () => {
	return {
		LogoUploader: ({ onChange }: { onChange: (key: string) => void }) => (
			<button type="button" onClick={() => onChange('tmp/logos/logo-1.png')}>
				Upload test logo
			</button>
		),
		ImageUploader: ({ onChange }: { onChange: (key: string) => void }) => (
			<button
				type="button"
				onClick={() => onChange('tmp/screenshots/wordmark-1.png')}
			>
				Upload test wordmark
			</button>
		),
	}
})
const clients: Array<QueryClient> = []
function mount() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	})
	clients.push(client)
	return render(
		<QueryClientProvider client={client}>
			<AdsAdmin />
		</QueryClientProvider>
	)
}
const id = '550e8400-e29b-41d4-a716-446655440001'
const row = () => {
	return {
		...campaign(id),
		logo: `ads/${id}/logo-${id}.png`,
		banner: `ads/${id}/banner-${id}.png`,
	}
}
beforeEach(() => {
	mock.rows = []
	mock.create.mockReset().mockResolvedValue(row())
	mock.update.mockReset().mockResolvedValue(row())
	mock.remove.mockReset().mockResolvedValue({ success: true })
})
afterEach(() => {
	cleanup()
	for (const client of clients.splice(0)) client.clear()
})
describe('admin campaign form', () => {
	it('creates a campaign with both uploads, configured CTA and month settings', async () => {
		mount()
		await screen.findByText(/No campaigns yet/)
		fireEvent.click(screen.getByRole('button', { name: 'Create campaign' }))
		for (const [name, value] of [
			['Advertiser name', 'Fixture brand'],
			['Short description', 'Useful synthetic test campaign.'],
			['Website URL', 'https://brand.example.test'],
			['CTA text', 'Visit fixture brand'],
			['Start month (UTC)', '2026-12'],
			['Duration in calendar months', '2'],
		]) {
			fireEvent.change(screen.getByLabelText(name), { target: { value } })
		}
		fireEvent.change(screen.getByLabelText('Tier'), {
			target: { value: 'tier3' },
		})
		fireEvent.change(screen.getByLabelText('Status'), {
			target: { value: 'active' },
		})
		fireEvent.click(screen.getByRole('button', { name: 'Upload test logo' }))
		fireEvent.click(
			screen.getByRole('button', { name: 'Upload test wordmark' })
		)
		expect(
			screen
				.getByRole('link', { name: /Visit fixture brand/ })
				.getAttribute('rel')
		).toContain('sponsored')
		fireEvent.click(screen.getByRole('button', { name: 'Save campaign' }))
		await waitFor(() =>
			expect(mock.create.mock.calls[0]?.[0]).toMatchObject({
				body: {
					name: 'Fixture brand',
					logo: 'tmp/logos/logo-1.png',
					banner: 'tmp/screenshots/wordmark-1.png',
					tier: 'tier3',
					status: 'active',
					startMonth: '2026-12',
					months: 2,
				},
			})
		)
		await waitFor(() =>
			expect(screen.queryByRole('button', { name: 'Save campaign' })).toBeNull()
		)
	})
	it('sends the saved version on edits and preserves input on a failed save', async () => {
		mock.rows = [row()]
		mock.update.mockRejectedValue(new Error('CONFLICT'))
		mount()
		fireEvent.click(await screen.findByRole('button', { name: /^Edit/ }))
		fireEvent.change(screen.getByLabelText('Advertiser name'), {
			target: { value: 'Edited fixture' },
		})
		fireEvent.click(screen.getByRole('button', { name: 'Save campaign' }))
		await screen.findByRole('alert')
		expect(mock.update.mock.calls[0]?.[0]).toMatchObject({
			params: { id },
			body: {
				expectedVersion: 1,
				name: 'Edited fixture',
			},
		})
		expect(screen.getByLabelText('Advertiser name')).toHaveProperty(
			'value',
			'Edited fixture'
		)
	})
	it('requires explicit deletion confirmation and supports cancel', async () => {
		mock.rows = [row()]
		mount()
		fireEvent.click(await screen.findByRole('button', { name: /^Delete/ }))
		expect(mock.remove).not.toHaveBeenCalled()
		fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
		expect(mock.remove).not.toHaveBeenCalled()
		fireEvent.click(screen.getByRole('button', { name: /^Delete/ }))
		fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }))
		await waitFor(() =>
			expect(mock.remove).toHaveBeenCalledWith({
				params: { id },
				body: { expectedVersion: 1 },
			})
		)
	})
})
