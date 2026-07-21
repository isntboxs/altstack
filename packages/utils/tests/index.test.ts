import { expect, it } from 'vite-plus/test'

import { fn } from '../src/index.ts'

it('fn', () => {
	expect(fn()).toBe('Hello, tsdown!')
})
