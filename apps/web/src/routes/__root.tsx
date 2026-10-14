import { TanStackDevtools } from '@tanstack/react-devtools'
import { FormDevtoolsPanel } from '@tanstack/react-form-devtools'
import type { QueryClient } from '@tanstack/react-query'
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools'
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { createMiddleware } from '@tanstack/react-start'
import { TableDevtoolsPanel } from '@tanstack/react-table-devtools'
import { evlogErrorHandler } from 'evlog/nitro/v3'

import { ThemeProvider } from '@altstack/ui/components/customs/theme-provider'
import { Toaster } from '@altstack/ui/components/toast'
import { TooltipProvider } from '@altstack/ui/components/tooltip'

import { LogProvider } from '#/components/log-provider'
import { indexingMiddleware } from '#/features/seo/indexing'
import { unavailableHead } from '#/features/seo/meta'
import { getAuthFn } from '#/functions/get-auth-fn'
import { useAuthIdentity } from '#/hooks/use-auth-identity'
import appCss from '#/styles.css?url'
import type { orpc } from '#/utils/orpc'

interface RouterAppContext {
	orpc: typeof orpc
	queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
	server: {
		middleware: [
			createMiddleware().server(evlogErrorHandler),
			indexingMiddleware,
		],
	},
	beforeLoad: async () => {
		const auth = await getAuthFn()
		return { auth }
	},
	notFoundComponent: () => (
		<main>
			<h1>Page not found</h1>
			<a href="/">Browse projects</a>
		</main>
	),
	errorComponent: () => (
		<main>
			<h1>Page unavailable</h1>
			<p>Please try again later.</p>
			<a href="/">Browse projects</a>
		</main>
	),
	shellComponent: RootDocument,
	component: RootComponent,
	head: () => {
		return {
			meta: [
				...unavailableHead().meta,
				{
					charSet: 'utf-8',
				},
				{
					name: 'viewport',
					content:
						'width=device-width, initial-scale=1, interactive-widget=resizes-content',
				},
			],
			links: [
				{
					rel: 'stylesheet',
					href: appCss,
				},
				{
					rel: 'icon',
					href: '/favicon.ico',
					sizes: '16x16 32x32 48x48',
				},
				{
					rel: 'icon',
					href: '/favicon.svg',
					type: 'image/svg+xml',
					sizes: 'any',
				},
				{
					rel: 'apple-touch-icon',
					href: '/apple-touch-icon.png',
					sizes: '180x180',
				},
				{
					rel: 'manifest',
					href: '/manifest.json',
				},
			],
		}
	},
})

function RootDocument({ children }: { children: React.ReactNode }) {
	useAuthIdentity()

	return (
		<html
			lang="en"
			className="scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent scrollbar-gutter-stable selection:bg-primary selection:text-primary-foreground"
			suppressHydrationWarning
		>
			<head>
				<HeadContent />
			</head>
			<body>
				{children}
				<TanStackDevtools
					config={{
						position: 'bottom-right',
					}}
					plugins={[
						{
							name: 'Tanstack Router',
							render: <TanStackRouterDevtoolsPanel />,
						},
						{
							name: 'Tanstack Query',
							render: <ReactQueryDevtoolsPanel />,
						},
						{
							name: 'Tanstack Form',
							render: <FormDevtoolsPanel />,
						},
						{
							name: 'Tanstack Table',
							render: <TableDevtoolsPanel />,
						},
					]}
				/>
				<Scripts />
			</body>
		</html>
	)
}

function RootComponent() {
	return (
		<LogProvider>
			<ThemeProvider
				attribute="class"
				defaultTheme="system"
				disableTransitionOnChange
				storageKey="theme"
			>
				<TooltipProvider>
					<Outlet />
				</TooltipProvider>
				<Toaster />
			</ThemeProvider>
		</LogProvider>
	)
}
