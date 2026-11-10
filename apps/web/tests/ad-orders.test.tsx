// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from '@testing-library/react'
import { StrictMode } from 'react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { ORPCRouterInputs } from '@altstack/api/routers'

import type { AdOrderView } from '@altstack/shared/schemas/ad-billing'

import { AdvertisePage } from '#/features/ads/advertise-page'
import {
	captureAdAccess,
	forgetAdAccess,
} from '#/features/ads/management-access'
import { AdOrderManage } from '#/features/ads/order-manage'
import { AdvertisingAdmin } from '#/features/ads/orders-admin'

const mock = vi.hoisted(() => {
	return {
		create: vi.fn(),
		get: vi.fn(),
		submit:
			vi.fn<
				(input: ORPCRouterInputs['adBilling']['submit']) => Promise<AdOrderView>
			>(),
		requestAccess: vi.fn(),
		requestRenewal: vi.fn(),
		confirmPayment: vi.fn(),
		review: vi.fn(),
		setStatus: vi.fn(),
		navigate: vi.fn(),
		orders: [] as Array<AdOrderView & { payments: [] }>,
		available: true,
	}
})
vi.mock('@tanstack/react-router', () => {
	return {
		useRouter: () => {
			return { navigate: mock.navigate }
		},
		Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
			<a href={to} {...props}>
				{children}
			</a>
		),
	}
})
vi.mock('#/utils/orpc', () => {
	return {
		client: {
			adBilling: {
				create: mock.create,
				get: mock.get,
				submit: mock.submit,
				requestAccess: mock.requestAccess,
				requestRenewal: mock.requestRenewal,
				upload: { logo: {}, banner: {} },
			},
			admin: {
				adBilling: {
					confirmPayment: mock.confirmPayment,
					review: mock.review,
					setStatus: mock.setStatus,
				},
			},
		},
		orpc: {
			adBilling: {
				config: {
					queryOptions: () => {
						return {
							queryKey: ['ad-config'],
							queryFn: () =>
								Promise.resolve({
									available: mock.available,
									contactEmail: 'team@example.test',
								}),
						}
					},
				},
			},
			admin: {
				adBilling: {
					key: () => ['admin', 'adBilling'],
					list: {
						queryOptions: () => {
							return {
								queryKey: ['admin', 'adBilling', 'list'],
								queryFn: () => Promise.resolve(mock.orders),
							}
						},
					},
				},
				ads: {
					key: () => ['admin', 'ads'],
					list: {
						queryOptions: () => {
							return {
								queryKey: ['admin', 'ads', 'list'],
								queryFn: () => Promise.resolve([]),
							}
						},
					},
				},
			},
		},
	}
})
vi.mock('#/features/ads/admin-editor', () => {
	return {
		AdsAdmin: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	}
})
vi.mock('#/features/ads/provider', () => {
	return {
		inventoryOptions: () => {
			return { queryKey: ['ads', 'inventory'] }
		},
	}
})
vi.mock('#/features/ads/components', () => {
	return { AdCard: () => null }
})
vi.mock('#/utils/storage', () => {
	return {
		resolveFileUrl: (key: string) => `https://assets.example.test/${key}`,
	}
})
vi.mock('#/components/image-uploader', () => {
	return {
		LogoUploader: ({ onChange }: { onChange: (key: string) => void }) => (
			<button type="button" onClick={() => onChange('tmp/logos/logo-1.png')}>
				Upload test logo
			</button>
		),
		ImageUploader: () => <span>Wordmark uploader</span>,
	}
})
const id = '550e8400-e29b-41d4-a716-446655440001',
	token = '1234567890.' + 'a'.repeat(43)
const row = (): AdOrderView => {
	return {
		id,
		plan: 'core',
		amount: 1500,
		currency: 'usd',
		status: 'pending_payment',
		email: 'advertiser@example.test',
		material: null,
		feedback: null,
		paidAt: null,
		startsAt: null,
		paidThrough: null,
		renewalRequestedAt: null,
		campaignId: null,
		version: 1,
		createdAt: new Date('2026-11-01T00:00:00Z'),
	}
}
const clients: Array<QueryClient> = []
function mount(component: ReactNode) {
	const query = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	})
	clients.push(query)
	render(<QueryClientProvider client={query}>{component}</QueryClientProvider>)
	return query
}
beforeEach(() => {
	forgetAdAccess()
	window.sessionStorage.clear()
	window.history.replaceState(null, '', '/advertise')
	for (const action of [
		mock.create,
		mock.get,
		mock.submit,
		mock.requestAccess,
		mock.requestRenewal,
		mock.confirmPayment,
		mock.review,
		mock.setStatus,
		mock.navigate,
	]) {
		action.mockReset()
	}
	mock.available = true
	mock.orders = []
	mock.create.mockResolvedValue({ success: true })
	mock.requestAccess.mockResolvedValue({ success: true })
	mock.get.mockResolvedValue(row())
	mock.submit.mockImplementation(({ body }) =>
		Promise.resolve({
			...row(),
			paidAt: new Date(),
			status: 'in_review',
			material: body.material,
			version: 3,
		})
	)
	mock.requestRenewal.mockResolvedValue({
		...row(),
		renewalRequestedAt: new Date(),
	})
	mock.confirmPayment.mockResolvedValue({
		...row(),
		paidAt: new Date(),
		status: 'awaiting_materials',
		version: 2,
	})
	mock.review.mockResolvedValue({
		...row(),
		status: 'changes_requested',
		version: 3,
	})
})
afterEach(() => {
	cleanup()
	for (const query of clients.splice(0)) query.clear()
	vi.restoreAllMocks()
})
function openManage() {
	window.history.replaceState(
		null,
		'',
		`/advertise/manage#id=${id}&token=${token}`
	)
	return mount(<AdOrderManage />)
}

async function choosePackage(name = 'Plus') {
	const button = await screen.findByRole('button', { name: `Choose ${name}` })
	await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false))
	fireEvent.click(button)
	await screen.findByRole('dialog')
}

describe('guest order flow', () => {
	it.each([
		['core', 'Core', 'https://ko-fi.com/c/04c3fc24d3'],
		['plus', 'Plus', 'https://ko-fi.com/c/3da9b0e0d6'],
		['priority', 'Priority', 'https://ko-fi.com/c/e8bd0eb73f'],
	] as const)(
		'offers the matching Ko-fi checkout for %s after loading a private order',
		async (plan, name, url) => {
			mock.get.mockResolvedValue({ ...row(), plan })
			openManage()
			const link = await screen.findByRole('link', {
				name: new RegExp(`Pay ${name} on Ko-fi`),
			})
			expect(link.getAttribute('href')).toBe(url)
			expect(link.getAttribute('referrerpolicy')).toBe('no-referrer')
			expect(screen.getByText(/include your order reference/)).toBeTruthy()
			expect(
				screen.getByText(
					/Your first advertising month starts after materials are approved/
				)
			).toBeTruthy()
			expect(
				screen.queryByText(
					/Your campaign dates extend after the team confirms this renewal payment/
				)
			).toBeNull()
			expect(screen.getByText(id)).toBeTruthy()
			expect(screen.getByText('advertiser@example.test')).toBeTruthy()
			expect(mock.confirmPayment).not.toHaveBeenCalled()
		}
	)
	it('removes checkout after refreshing a confirmed payment', async () => {
		openManage()
		await screen.findByRole('link', { name: /Pay Core on Ko-fi/ })
		mock.get.mockResolvedValue({
			...row(),
			paidAt: new Date(),
			status: 'awaiting_materials',
		})
		fireEvent.click(screen.getByRole('button', { name: 'Refresh order' }))
		await screen.findByRole('button', { name: 'Upload advertising materials' })
		expect(screen.queryByRole('link', { name: /on Ko-fi/ })).toBeNull()
	})
	it('keeps private links usable during Strict Mode remounts when browser storage is blocked', async () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('denied')
		})
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('denied')
		})
		window.history.replaceState(
			null,
			'',
			`/advertise/manage#id=${id}&token=${token}`
		)
		mount(
			<StrictMode>
				<AdOrderManage />
			</StrictMode>
		)
		await screen.findByText('Waiting for payment confirmation')
		expect(window.location.hash).toBe('')
		expect(captureAdAccess()).toEqual({ id, token })
	})
	it('retains input and re-enables submission after an order request fails', async () => {
		mock.create.mockRejectedValue(new Error('Synthetic failure'))
		mount(<AdvertisePage />)
		await choosePackage()
		fireEvent.change(screen.getByLabelText('Contact email'), {
			target: { value: 'advertiser@example.test' },
		})
		fireEvent.click(screen.getByRole('checkbox'))
		const button = screen.getByRole('button', { name: 'Request Plus — US$29' })
		await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false))
		fireEvent.click(button)
		await screen.findByText(/Unable to request an order/)
		expect(screen.getByLabelText<HTMLInputElement>('Contact email').value).toBe(
			'advertiser@example.test'
		)
		expect(button.hasAttribute('disabled')).toBe(false)
	})
	it('shows agreed prices and sends a manual order after explicit terms acceptance', async () => {
		mount(<AdvertisePage />)
		expect(screen.getByText('15')).toBeTruthy()
		expect(screen.getByText('29')).toBeTruthy()
		expect(screen.getByText('55')).toBeTruthy()
		await choosePackage()
		const button = await screen.findByRole('button', {
			name: 'Request Plus — US$29',
		})
		expect(button.hasAttribute('disabled')).toBe(true)
		fireEvent.change(screen.getByLabelText('Contact email'), {
			target: { value: 'advertiser@example.test' },
		})
		fireEvent.click(screen.getByRole('checkbox'))
		await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false))
		fireEvent.click(button)
		await screen.findByText(/Check your email for your private management link/)
		expect(mock.create).toHaveBeenCalledWith({
			body: {
				plan: 'plus',
				email: 'advertiser@example.test',
				termsAccepted: true,
			},
		})
		expect(mock.confirmPayment).not.toHaveBeenCalled()
	})
	it('keeps package selection disabled without email configuration', async () => {
		mock.available = false
		mount(<AdvertisePage />)
		await screen.findByText(/Advertising orders are temporarily unavailable/)
		for (const name of ['Core', 'Plus', 'Priority']) {
			expect(
				screen
					.getByRole('button', { name: `Choose ${name}` })
					.hasAttribute('disabled')
			).toBe(true)
		}
		expect(screen.queryByRole('dialog')).toBeNull()
		expect(mock.create).not.toHaveBeenCalled()
	})
	it.each([
		['Core', 'core', 15],
		['Priority', 'priority', 55],
	] as const)(
		'opens the correct %s order without changing its price',
		async (name, plan, amount) => {
			mount(<AdvertisePage />)
			await choosePackage(name)
			expect(
				screen.getByRole('heading', { name: `Advertise with ${name}` })
			).toBeTruthy()
			fireEvent.change(screen.getByLabelText('Contact email'), {
				target: { value: 'advertiser@example.test' },
			})
			fireEvent.click(screen.getByRole('checkbox'))
			fireEvent.click(
				screen.getByRole('button', { name: `Request ${name} — US$${amount}` })
			)
			await waitFor(() =>
				expect(mock.create).toHaveBeenCalledWith({
					body: { plan, email: 'advertiser@example.test', termsAccepted: true },
				})
			)
		}
	)
	it('opens existing-order access from the pricing section', async () => {
		mount(<AdvertisePage />)
		fireEvent.click(
			screen.getByRole('button', {
				name: 'Already advertising? Manage your order',
			})
		)
		await screen.findByRole('dialog')
		fireEvent.change(screen.getByLabelText('Order email'), {
			target: { value: 'advertiser@example.test' },
		})
		fireEvent.click(
			screen.getByRole('button', { name: 'Email management link' })
		)
		await waitFor(() =>
			expect(mock.requestAccess).toHaveBeenCalledWith({
				body: { email: 'advertiser@example.test' },
			})
		)
	})
	it('shows actual placements and reveals the manual renewal FAQ', async () => {
		mount(<AdvertisePage />)
		expect(
			screen.getByRole('heading', { name: 'Where your brand appears' })
		).toBeTruthy()
		expect(document.querySelectorAll('[data-placement-preview]')).toHaveLength(
			4
		)
		const question = screen.getByRole('button', {
			name: 'How do payment and renewal work?',
		})
		expect(question.getAttribute('aria-expanded')).toBe('false')
		fireEvent.click(question)
		await waitFor(() =>
			expect(question.getAttribute('aria-expanded')).toBe('true')
		)
		expect(
			screen.getByText(
				/No account, card on file, or automatic renewal is required/
			)
		).toBeTruthy()
	})
	it('captures fragment credentials, removes them from the URL and preserves access across reloads', async () => {
		const query = openManage()
		await screen.findByText('Waiting for payment confirmation')
		expect(window.location.hash).toBe('')
		expect(mock.get).toHaveBeenCalledWith({ body: { id, token } })
		expect(captureAdAccess()).toEqual({ id, token })
		expect(
			JSON.stringify(
				query
					.getQueryCache()
					.getAll()
					.map((item) => item.queryKey)
			)
		).not.toContain(token)
		expect(
			screen.queryByRole('button', { name: 'Upload advertising materials' })
		).toBeNull()
	})
	it('rejects malformed fragments and works with valid links even when session storage is unavailable', () => {
		window.history.replaceState(
			null,
			'',
			'/advertise/manage#id=invalid&token=invalid'
		)
		expect(captureAdAccess()).toBeNull()
		expect(window.location.hash).toBe('')
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('denied')
		})
		window.history.replaceState(
			null,
			'',
			`/advertise/manage#id=${id}&token=${token}`
		)
		expect(captureAdAccess()).toEqual({ id, token })
		expect(window.location.hash).toBe('')
	})
	it('offers a fresh email link when private access fails', async () => {
		mock.get.mockRejectedValue(new Error('Expired'))
		openManage()
		await screen.findByRole('heading', { name: 'Already have an order?' })
		fireEvent.change(screen.getByLabelText('Order email'), {
			target: { value: 'advertiser@example.test' },
		})
		fireEvent.click(
			screen.getByRole('button', { name: 'Email management link' })
		)
		await screen.findByText(/If this email has advertising orders/)
		expect(mock.requestAccess).toHaveBeenCalledWith({
			body: { email: 'advertiser@example.test' },
		})
	})
	it('lets a paid Core advertiser submit a logo without wordmark, tier or admin CTA settings', async () => {
		mock.get.mockResolvedValue({
			...row(),
			paidAt: new Date(),
			status: 'awaiting_materials',
			version: 2,
		})
		openManage()
		fireEvent.click(
			await screen.findByRole('button', {
				name: 'Upload advertising materials',
			})
		)
		fireEvent.change(screen.getByLabelText('Advertiser name'), {
			target: { value: 'Synthetic advertiser' },
		})
		fireEvent.change(screen.getByLabelText('Short description'), {
			target: { value: 'An integration fixture.' },
		})
		fireEvent.change(screen.getByLabelText('Website URL'), {
			target: { value: 'https://advertiser.example.test' },
		})
		fireEvent.click(screen.getByRole('button', { name: 'Upload test logo' }))
		expect(screen.queryByText('Wordmark uploader')).toBeNull()
		fireEvent.click(
			screen.getByRole('button', { name: 'Submit materials for review' })
		)
		await waitFor(() => expect(mock.submit).toHaveBeenCalled())
		const input = mock.submit.mock.calls[0][0]
		expect(input.body).toMatchObject({
			id,
			token,
			expectedVersion: 2,
			material: {
				logo: 'tmp/logos/logo-1.png',
				banner: 'tmp/logos/logo-1.png',
			},
		})
		expect(input.body.material).not.toHaveProperty('tier')
		expect(input.body.material).not.toHaveProperty('ctaText')
	})
	it('requests a manually paid renewal without pretending payment has occurred', async () => {
		const live = {
			...row(),
			status: 'approved' as const,
			paidAt: new Date(),
			campaignId: id,
			startsAt: new Date(),
			paidThrough: new Date('2027-01-01T00:00:00Z'),
		}
		mock.get.mockResolvedValue(live)
		mock.requestRenewal.mockResolvedValue({
			...live,
			renewalRequestedAt: new Date(),
		})
		openManage()
		await screen.findByRole('button', { name: 'Request one more month' })
		expect(screen.queryByRole('link', { name: /on Ko-fi/ })).toBeNull()
		fireEvent.click(
			await screen.findByRole('button', { name: 'Request one more month' })
		)
		const requested = await screen.findByRole('button', {
			name: 'Renewal requested — awaiting payment',
		})
		expect(requested.hasAttribute('disabled')).toBe(true)
		expect(
			screen.getByText(
				/Your campaign dates extend after the team confirms this renewal payment/
			)
		).toBeTruthy()
		expect(
			screen.queryByText(
				/Your first advertising month starts after materials are approved/
			)
		).toBeNull()
		expect(
			screen
				.getByRole('link', { name: /Pay Core on Ko-fi/ })
				.getAttribute('href')
		).toBe('https://ko-fi.com/c/04c3fc24d3')
		expect(mock.confirmPayment).not.toHaveBeenCalled()
	})
})
describe('admin manual confirmation and material review', () => {
	it('keeps orders compact, opens one at a time, and combines search with status filters', async () => {
		mock.orders = [
			{ ...row(), payments: [] },
			{
				...row(),
				id: '550e8400-e29b-41d4-a716-446655440002',
				email: 'second@example.test',
				status: 'approved',
				paidAt: new Date(),
				payments: [],
			},
		]
		mount(<AdvertisingAdmin />)
		await screen.findByText('second@example.test')
		const statusFilter = screen.getByRole<HTMLSelectElement>('combobox', {
			name: 'Status',
		})
		expect(statusFilter.labels).toHaveLength(1)
		expect(statusFilter.labels[0].control).toBe(statusFilter)
		expect(statusFilter.value).toBe('all')
		expect(screen.queryByLabelText('Initial payment reference')).toBeNull()
		fireEvent.click(screen.getByRole('button', { name: 'Review order' }))
		expect(screen.getByLabelText('Initial payment reference')).toBeTruthy()
		fireEvent.click(screen.getByRole('button', { name: 'View details' }))
		expect(screen.queryByLabelText('Initial payment reference')).toBeNull()
		expect(
			screen.getAllByRole('button', { name: 'Close details' })
		).toHaveLength(1)
		fireEvent.change(statusFilter, {
			target: { value: 'attention' },
		})
		expect(screen.getByRole('combobox', { name: 'Status' })).toHaveProperty(
			'value',
			'attention'
		)
		expect(screen.queryByText('second@example.test')).toBeNull()
		fireEvent.change(screen.getByLabelText('Search orders'), {
			target: { value: 'second' },
		})
		expect(screen.getByText('No matching orders')).toBeTruthy()
		fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
		expect(screen.getByRole('button', { name: 'Close details' })).toBeTruthy()
		fireEvent.change(screen.getByLabelText('Search orders'), {
			target: { value: 'ADVERTISER@EXAMPLE.TEST' },
		})
		expect(screen.queryByText('second@example.test')).toBeNull()
		expect(screen.getByRole('button', { name: 'Review order' })).toBeTruthy()
	})
	it('requires explicit receipt verification and a payment reference', async () => {
		mock.orders = [{ ...row(), payments: [] }]
		mount(<AdvertisingAdmin />)
		fireEvent.click(await screen.findByRole('button', { name: 'Review order' }))
		const button = await screen.findByRole('button', {
			name: 'Record received payment',
		})
		expect(button.hasAttribute('disabled')).toBe(true)
		fireEvent.change(screen.getByLabelText('Initial payment reference'), {
			target: { value: 'bank:fixture-1' },
		})
		fireEvent.click(
			screen.getByRole('checkbox', {
				name: 'I independently verified receipt of this payment.',
			})
		)
		fireEvent.click(button)
		await waitFor(() =>
			expect(mock.confirmPayment).toHaveBeenCalledWith({
				body: {
					id,
					expectedVersion: 1,
					kind: 'initial',
					reference: 'bank:fixture-1',
				},
			})
		)
		expect(mock.review).not.toHaveBeenCalled()
	})
	it('requires review feedback and submits the chosen CTA and color', async () => {
		mock.orders = [
			{
				...row(),
				status: 'in_review',
				paidAt: new Date(),
				material: {
					name: 'Fixture',
					description: 'Fixture',
					websiteUrl: 'https://example.test',
					logo: `ads/${id}/logo-${id}.png`,
					banner: `ads/${id}/banner-${id}.png`,
				},
				payments: [],
			},
		]
		mount(<AdvertisingAdmin />)
		fireEvent.click(await screen.findByRole('button', { name: 'Review order' }))
		fireEvent.click(
			await screen.findByRole('button', { name: 'Request changes' })
		)
		expect(mock.review).not.toHaveBeenCalled()
		expect(screen.getByRole('alert').textContent).toContain('Provide feedback')
		fireEvent.change(screen.getByLabelText('Review feedback'), {
			target: { value: 'Please update the logo.' },
		})
		fireEvent.change(screen.getByLabelText('CTA text'), {
			target: { value: 'View product' },
		})
		fireEvent.change(screen.getByLabelText('CTA button color'), {
			target: { value: '#123456' },
		})
		fireEvent.click(screen.getByRole('button', { name: 'Request changes' }))
		await waitFor(() =>
			expect(mock.review).toHaveBeenCalledWith({
				body: {
					id,
					expectedVersion: 1,
					decision: 'revise',
					reason: 'Please update the logo.',
					ctaText: 'View product',
					buttonColor: '#123456',
				},
			})
		)
	})
})
