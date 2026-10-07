import { Link, useRouter } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'

import { Button } from '@altstack/ui/components/button'

export function CategoryLoading() {
	return (
		<output className="block p-6 text-sm text-muted-foreground">
			Loading categories…
		</output>
	)
}

export function CategoryNotFound() {
	return (
		<div className="space-y-3 p-6">
			<h1 className="text-xl font-semibold">Category not found</h1>
			<p>This category may have been deleted, or its ID is invalid.</p>
			<Link to="/admin/categories" className="underline">
				Back to categories
			</Link>
		</div>
	)
}

export function CategoryRouteError({ error }: ErrorComponentProps) {
	const router = useRouter()
	return (
		<div className="space-y-3 p-6">
			<h1 className="text-xl font-semibold">Unable to load categories</h1>
			<p role="alert">
				{error instanceof Error ? error.message : 'Please retry.'}
			</p>
			<Button onClick={() => void router.invalidate()}>Retry</Button>
			<Link to="/admin/categories" className="ml-3 underline">
				Back to categories
			</Link>
		</div>
	)
}
