import type { Selection } from './selection'
import { queryOptions, useQuery } from '@tanstack/react-query'
import { useLocation } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { client } from '#/utils/orpc'
import { AdsContext, emptyAds } from './context'
import { readSession, selectAds, selectionKey, sessionStore } from './selection'

const placements = [
	'banner',
	'listing',
	'collection-detail',
	'project-detail',
] as const
export const inventoryOptions = (entry = '') =>
	queryOptions({
		queryKey: ['ads', 'inventory', entry],
		queryFn: () => client.ads.list({}, { context: { cache: 'no-store' } }),
		staleTime: 0,
		refetchInterval: 5000,
		refetchOnWindowFocus: 'always',
		retry: false,
	})
export function AdsProvider({
	children,
	enabled = true,
}: {
	children: ReactNode
	enabled?: boolean
}) {
	const entry = useLocation({
		select: (location) => location.pathname + location.searchStr,
	})
	const inventory = useQuery({
		...inventoryOptions(entry),
		enabled: enabled && typeof window !== 'undefined',
	})
	const [state, setState] = useState(emptyAds)
	const committed = useRef(emptyAds)
	useEffect(() => {
		if (!enabled || !inventory.data || inventory.isError) return
		const payload = inventory.data
		const clockOffset = new Date(payload.serverNow).getTime() - Date.now()
		const update = () => {
			const now = Date.now() + clockOffset
			const previous = committed.current
			const selections = { ...previous.selections }
			for (const placement of placements) {
				const stored = readSession<Selection | undefined>(
					selectionKey(placement),
					undefined
				)
				const valid =
					stored &&
					Array.isArray(stored.ids) &&
					stored.ids.every((id) => typeof id === 'string')
						? stored
						: undefined
				const selection =
					previous.entry !== entry || !previous.selections[placement]
						? selectAds(
								payload.campaigns,
								placement,
								placement === 'listing' ? 3 : 1,
								now,
								valid
							)
						: previous.selections[placement]
				selections[placement] = selection
				if (selection !== previous.selections[placement]) {
					sessionStore().setItem(
						selectionKey(placement),
						JSON.stringify(selection)
					)
				}
			}
			committed.current = {
				campaigns: payload.campaigns,
				selections,
				now,
				entry,
			}
			setState(committed.current)
		}
		update()
		// Only eligibility is reevaluated while reading; TTL does not trigger a swap.
		const timer = window.setInterval(update, 1000)
		return () => clearInterval(timer)
	}, [inventory.data, inventory.isError, entry, enabled])
	return (
		<AdsContext value={enabled && !inventory.isError ? state : emptyAds}>
			{children}
		</AdsContext>
	)
}
