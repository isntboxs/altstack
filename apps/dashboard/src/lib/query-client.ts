import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'

function reportQueryError(message: string, metadata: Record<string, unknown>) {
	if (typeof globalThis.reportError === 'function') {
		globalThis.reportError({ message, metadata })
		return
	}

	console.debug(message, metadata)
}

export const createQueryClient = () =>
	new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 30 * 1000, // 30 seconds
				gcTime: 5 * 60 * 1000, // 5 minutes
				retry: 3,
			},
		},

		queryCache: new QueryCache({
			onError: (error, query) => {
				reportQueryError('[Query Error]', { queryKey: query.queryKey, error })
			},
		}),

		mutationCache: new MutationCache({
			onError: (error, mutation) => {
				reportQueryError('[Mutation Error]', {
					mutationKey: (mutation as { options: { mutationKey?: unknown } })
						.options.mutationKey,
					error,
				})
			},
		}),
	})

let clientQueryClientSingleton: QueryClient | undefined = undefined
export const getQueryClient = () => {
	if (typeof window === 'undefined') {
		// Server: always make a new query client
		return createQueryClient()
	}
	// Browser: use singleton pattern to keep the same query client
	clientQueryClientSingleton ??= createQueryClient()

	return clientQueryClientSingleton
}
