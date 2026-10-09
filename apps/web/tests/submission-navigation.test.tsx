import { cleanup, render, screen } from '@testing-library/react'
// @vitest-environment jsdom
import type { ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { SidebarProvider } from '@altstack/ui/components/sidebar'

import { MainSidebarContent } from '#/components/main-sidebar-content'
import { submissionSearchSchema } from '#/features/submissions/search'

const auth = vi.hoisted(() => {
	return { role: 'user' }
})
vi.mock('@tanstack/react-router', () => {
	return {
		linkOptions: (options: unknown) => options,
		Link: ({
			to,
			children,
			icon: _icon,
			label: _label,
			activeOptions: _active,
			viewTransition: _transition,
			...props
		}: ComponentProps<'a'> & {
			to: string
			icon?: unknown
			label?: string
			activeOptions?: unknown
			viewTransition?: unknown
		}) => (
			<a href={to} {...props}>
				{children}
			</a>
		),
		useMatchRoute: () => () => false,
		useRouteContext: () => {
			return { auth: { user: { role: auth.role } } }
		},
	}
})
afterEach(cleanup)
beforeEach(() => {
	vi.stubGlobal('matchMedia', () => {
		return {
			matches: false,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		}
	})
})
afterEach(() => vi.unstubAllGlobals())

describe('role-specific navigation', () => {
	it('shows Submission for regular users and full moderation navigation for admins', () => {
		auth.role = 'user'
		const view = render(
			<SidebarProvider>
				<MainSidebarContent />
			</SidebarProvider>
		)
		expect(
			screen.getByText('Submission').closest('a')?.getAttribute('href')
		).toBe('/submission')
		expect(screen.queryByText('Projects')).toBeNull()
		auth.role = 'admin'
		view.rerender(
			<SidebarProvider>
				<MainSidebarContent />
			</SidebarProvider>
		)
		expect(
			screen.getByText('Projects').closest('a')?.getAttribute('href')
		).toBe('/projects')
		expect(screen.getByText('Categories')).toBeTruthy()
		expect(screen.queryByText('Submission')).toBeNull()
	})
	it('preserves entered search text and normalizes malformed pagination', () => {
		expect(
			submissionSearchSchema.parse({ q: '  project  ', page: -1, limit: 999 })
		).toEqual({ q: '  project  ', page: 1, limit: 25 })
		expect(
			submissionSearchSchema.parse({ q: 'x'.repeat(101), page: 2, limit: 10 })
		).toEqual({ q: '', page: 2, limit: 10 })
	})
})
