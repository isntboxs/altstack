import { adAccessSchema } from '@altstack/shared/schemas/ad-billing'
import type { AdAccess } from '@altstack/shared/schemas/ad-billing'

const key = 'altstack:ad-management:v1'
let memory: AdAccess | null = null
export function forgetAdAccess() {
	memory = null
	try {
		window.sessionStorage.removeItem(key)
	} catch {
		/* Browser storage may be disabled. */
	}
}
export function captureAdAccess(): AdAccess | null {
	if (typeof window === 'undefined') return null
	const fragment = new URLSearchParams(window.location.hash.slice(1))
	if (fragment.has('id') || fragment.has('token')) {
		const parsed = adAccessSchema.safeParse({
			id: fragment.get('id'),
			token: fragment.get('token'),
		})
		window.history.replaceState(
			window.history.state,
			'',
			window.location.pathname + window.location.search
		)
		memory = parsed.success ? parsed.data : null
		try {
			if (parsed.success) {
				window.sessionStorage.setItem(key, JSON.stringify(parsed.data))
			} else window.sessionStorage.removeItem(key)
		} catch {
			/* The current page can work when browser storage is disabled. */
		}
		return memory
	}
	try {
		const parsed = adAccessSchema.safeParse(
			JSON.parse(window.sessionStorage.getItem(key) ?? 'null')
		)
		if (parsed.success) memory = parsed.data
		return memory
	} catch {
		return memory
	}
}
