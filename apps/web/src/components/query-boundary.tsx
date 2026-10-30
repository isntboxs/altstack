import { QueryErrorResetBoundary } from '@tanstack/react-query'
import { CatchBoundary } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { Suspense } from 'react'

import { Button } from '@altstack/ui/components/button'

export function QueryBoundary({
	children,
	pending,
	error,
	resetKey = '',
}: {
	children: ReactNode
	pending: ReactNode
	error?: (error: Error, retry: () => void) => ReactNode
	resetKey?: string
}) {
	return (
		<QueryErrorResetBoundary key={resetKey}>
			{({ reset }) => (
				<CatchBoundary
					getResetKey={() => resetKey}
					errorComponent={({ error: reason, reset: resetBoundary }) => {
						const retry = () => {
							reset()
							resetBoundary()
						}
						return error ? (
							error(
								reason instanceof Error
									? reason
									: new Error('Unable to load data.'),
								retry
							)
						) : (
							<div className="flex flex-col gap-3 p-4">
								<p role="alert">Unable to load data. Please try again.</p>
								<Button
									className="self-start"
									variant="outline"
									onClick={retry}
								>
									Retry loading
								</Button>
							</div>
						)
					}}
				>
					<Suspense fallback={pending}>{children}</Suspense>
				</CatchBoundary>
			)}
		</QueryErrorResetBoundary>
	)
}
