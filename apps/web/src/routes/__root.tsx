import { TanStackDevtools } from '@tanstack/react-devtools'
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
import { evlogErrorHandler } from 'evlog/nitro/v3'

import { ThemeProvider } from '@altstack/ui/components/customs/theme-provider'
import { TooltipProvider } from '@altstack/ui/components/tooltip'

import { LogProvider } from '#/components/log-provider'
import { getAuthFn } from '#/functions/get-auth-fn'
import appCss from '#/styles.css?url'
import type { orpc } from '#/utils/orpc'

interface RouterAppContext {
	orpc: typeof orpc
	queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
	server: {
		middleware: [createMiddleware().server(evlogErrorHandler)],
	},
	beforeLoad: async () => {
		const auth = await getAuthFn()
		return { auth }
	},
	shellComponent: RootDocument,
	component: RootComponent,
	head: () => {
		return {
			meta: [
				{
					charSet: 'utf-8',
				},
				{
					name: 'viewport',
					content: 'width=device-width, initial-scale=1',
				},
				{
					title: 'TanStack Start Starter',
				},
			],
			links: [
				{
					rel: 'stylesheet',
					href: appCss,
				},
			],
		}
	},
})

function RootDocument({ children }: { children: React.ReactNode }) {
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
			</ThemeProvider>
		</LogProvider>
	)
}
