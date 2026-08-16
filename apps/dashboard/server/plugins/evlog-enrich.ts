import {
	createUserAgentEnricher,
	createRequestSizeEnricher,
} from 'evlog/enrichers'
import { definePlugin } from 'nitro'

export default definePlugin((nitroApp) => {
	const enrichers = [createUserAgentEnricher(), createRequestSizeEnricher()]

	nitroApp.hooks.hook('evlog:enrich', (ctx) => {
		for (const enricher of enrichers) enricher(ctx)
	})
})
