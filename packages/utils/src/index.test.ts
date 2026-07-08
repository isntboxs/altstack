import { expect, it } from 'vite-plus/test'

import { fn } from './index.ts'

it('fn', () => {
	expect(fn()).toBe('Hello, tsdown!')
})
