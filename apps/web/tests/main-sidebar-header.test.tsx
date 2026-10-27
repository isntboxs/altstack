// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { SidebarProvider } from '@altstack/ui/components/sidebar'

import { MainSidebarHeader } from '#/components/main-sidebar-header'

const auth = vi.hoisted(() => {
	return { role: 'user' }
})

vi.mock('@altstack/env/web', () => {
	return {
		env: { VITE_APP_NAME: 'Custom Catalog' },
	}
})
vi.mock('@tanstack/react-router', () => {
	return {
		Link: ({
			to,
			children,
			...props
		}: ComponentProps<'a'> & { to: string }) => (
			<a href={to} {...props}>
				{children}
			</a>
		),
		useRouteContext: () => {
			return { auth: { user: { role: auth.role } } }
		},
	}
})

beforeEach(() => {
	vi.stubGlobal('matchMedia', () => {
		return {
			matches: false,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		}
	})
})
afterEach(() => {
	cleanup()
	vi.unstubAllGlobals()
})

describe.each([true, false])(
	'workspace header with sidebar open=%s',
	(open) => {
		it.each([
			{ role: 'admin', workspace: 'Admin workspace', href: '/admin' },
			{ role: 'user', workspace: 'Your workspace', href: '/managed' },
			{ role: 'owner', workspace: 'Your workspace', href: '/managed' },
			{ role: 'maintainer', workspace: 'Your workspace', href: '/managed' },
		])(
			'names the $role workspace using its visible brand and role text',
			({ role, workspace, href }) => {
				auth.role = role
				render(
					<SidebarProvider defaultOpen={open}>
						<MainSidebarHeader />
					</SidebarProvider>
				)

				const link = screen.getByRole('link', {
					name: `Custom Catalog ${workspace}`,
				})
				expect(link.getAttribute('href')).toBe(href)
				expect(screen.getByText('Custom Catalog').closest('a')).toBe(link)
				expect(screen.getByText(workspace).closest('a')).toBe(link)
			}
		)
	}
)
