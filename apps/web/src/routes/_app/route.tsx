import { createFileRoute, useLocation } from '@tanstack/react-router'

import { Footer } from '#/components/footer'
import { Header } from '#/components/header'
import { AdBanner, CornerAd } from '#/features/ads/components'
import { AdsProvider } from '#/features/ads/provider'
import { CatalogueShell } from '#/features/project/components/catalogue-shell'

export const Route = createFileRoute('/_app')({
	component: RouteComponent,
})

function RouteComponent() {
	const { auth } = Route.useRouteContext()
	const privateRoute = useLocation({
		select: (location) => location.pathname === '/submit',
	})
	return (
		<AdsProvider enabled={!privateRoute}>
			<div className="flex min-h-dvh flex-col">
				<Header auth={auth} />
				{!privateRoute && <AdBanner />}

				<main className="flex-1">
					<CatalogueShell />
				</main>
				<Footer />
				{!privateRoute && <CornerAd />}
			</div>
		</AdsProvider>
	)
}
