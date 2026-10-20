import { createFileRoute } from '@tanstack/react-router'

import { Footer } from '#/components/footer'
import { Header } from '#/components/header'
import { CatalogueShell } from '#/features/project/components/catalogue-shell'

export const Route = createFileRoute('/_app')({
	component: RouteComponent,
})

function RouteComponent() {
	const { auth } = Route.useRouteContext()
	return (
		<div className="flex min-h-dvh flex-col">
			<Header auth={auth} />

			<div className="pointer-events-none fixed inset-x-0 top-12 z-40 h-12 bg-linear-to-b from-background via-background/40 to-transparent" />

			<main className="flex-1">
				<CatalogueShell />
			</main>
			<Footer />
		</div>
	)
}
