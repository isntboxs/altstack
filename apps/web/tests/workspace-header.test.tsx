// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { SidebarProvider } from '@altstack/ui/components/sidebar'

import { WorkspaceHeader } from '#/components/workspace-header'

const location = vi.hoisted(() => {
	return { pathname: '/admin' }
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
		useLocation: ({
			select,
		}: {
			select: (value: { pathname: string }) => string
		}) => select(location),
		useRouteContext: () => {
			return { auth: { user: { role: 'admin' } } }
		},
	}
})
vi.mock('#/components/theme-switcher', () => {
	return { ThemeSwitcher: () => null }
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

describe('workspace breadcrumb title', () => {
	it.each([
		['/admin/categories/category-id/edit', 'Edit category'],
		['/admin/categories/category-id/edit/', 'Edit category'],
		['/admin/categories/create', 'Create category'],
		['/projects/project-id/edit', 'Edit project'],
		['/managed/project-id/members', 'Project members'],
		['/admin/users/user-id', 'User details'],
		['/managed/project-id', 'Manage project'],
	])('labels %s as %s', (pathname, title) => {
		location.pathname = pathname
		render(
			<SidebarProvider>
				<WorkspaceHeader />
			</SidebarProvider>
		)
		expect(
			screen.getByRole('link', { name: title }).getAttribute('aria-current')
		).toBe('page')
	})
})
