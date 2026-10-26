import { Link, useLocation, useRouteContext } from '@tanstack/react-router'

import { Badge } from '@altstack/ui/components/badge'
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from '@altstack/ui/components/breadcrumb'
import { Separator } from '@altstack/ui/components/separator'
import { SidebarTrigger } from '@altstack/ui/components/sidebar'

import { ThemeSwitcher } from '#/components/theme-switcher'

const labels: Record<string, string> = {
	'/admin': 'Overview',
	'/admin/submissions': 'Submissions',
	'/admin/ownership': 'Ownership requests',
	'/admin/reports': 'Reports',
	'/admin/categories': 'Categories',
	'/admin/categories/create': 'Create category',
	'/admin/tags': 'Tags',
	'/admin/featured': 'Featured projects',
	'/admin/users': 'Users',
	'/admin/activity': 'Activity',
	'/admin/operations': 'Operations',
	'/projects': 'All projects',
	'/projects/create': 'Create project',
	'/managed': 'My projects',
	'/submission': 'Submission',
	'/bookmarks': 'Bookmarks',
}
export function WorkspaceHeader() {
	const { auth } = useRouteContext({ from: '/_main' })
	const path = useLocation({
		select: (location) => location.pathname.replace(/\/$/, ''),
	})
	const title =
		labels[path] ??
		(path.startsWith('/admin/users/')
			? 'User details'
			: path.endsWith('/members')
				? 'Project members'
				: path.endsWith('/edit')
					? 'Edit project'
					: 'Manage project')
	return (
		<header className="sticky top-0 z-20 flex min-h-14 items-center justify-between gap-3 border-b bg-sidebar/95 px-4 backdrop-blur">
			<div className="flex min-w-0 items-center gap-3">
				<SidebarTrigger />
				<Separator orientation="vertical" className="h-4" />
				<Breadcrumb>
					<BreadcrumbList>
						<BreadcrumbItem className="hidden sm:inline-flex">
							<BreadcrumbLink
								render={
									<Link
										to={auth.user.role === 'admin' ? '/admin' : '/managed'}
									/>
								}
							>
								{auth.user.role === 'admin' ? 'Admin' : 'Workspace'}
							</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator className="hidden sm:block" />
						<BreadcrumbItem>
							<BreadcrumbPage>{title}</BreadcrumbPage>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
			</div>
			<div className="flex shrink-0 items-center gap-2">
				{auth.user.role === 'admin' && (
					<Badge variant="outline" className="hidden sm:inline-flex">
						Admin
					</Badge>
				)}
				<ThemeSwitcher />
			</div>
		</header>
	)
}
