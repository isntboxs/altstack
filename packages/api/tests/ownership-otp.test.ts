import { describe, expect, it } from 'vite-plus/test'

import { claimClientIp } from '@altstack/api/ownership-otp'

describe('claim client IP validation', () => {
	it.each(['192.0.2.10', '2001:db8::10'])(
		'accepts a single address: %s',
		(ip) => {
			expect(claimClientIp(new Headers({ 'x-forwarded-for': ` ${ip} ` }))).toBe(
				ip
			)
		}
	)
	it.each(['', 'invalid', '192.0.2.10:8080', '192.0.2.10, 198.51.100.20'])(
		'ignores invalid or ambiguous addresses without trusting alternate headers: %s',
		(ip) => {
			expect(
				claimClientIp(
					new Headers({
						'x-forwarded-for': ip,
						'x-real-ip': '192.0.2.99',
						'cf-connecting-ip': '192.0.2.99',
					})
				)
			).toBeUndefined()
		}
	)
	it('leaves missing client addresses unavailable', () => {
		expect(claimClientIp()).toBeUndefined()
		expect(
			claimClientIp(new Headers({ 'x-real-ip': '192.0.2.99' }))
		).toBeUndefined()
	})
})
