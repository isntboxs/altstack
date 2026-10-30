import {
	IconActivity,
	IconBookmark,
	IconCategory,
	IconChevronDown,
	IconFlag,
	IconInbox,
	IconLayoutDashboard,
	IconPackage,
	IconPlus,
	IconRefresh,
	IconServer,
	IconStar,
	IconTags,
	IconUserCheck,
	IconUsers,
} from '@tabler/icons-react'
import { useSuspenseQuery } from '@tanstack/react-query'
import {
	Link,
	linkOptions,
	useMatchRoute,
	useRouteContext,
} from '@tanstack/react-router'
import { useState } from 'react'
import type { ReactNode } from 'react'

import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from '@altstack/ui/components/collapsible'
import {
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	SidebarSeparator,
	useSidebar,
} from '@altstack/ui/components/sidebar'

import { QueryBoundary } from '#/components/query-boundary'
import { dashboardQueries } from '#/features/admin-dashboard/queries'

const overview = linkOptions([
	{ to: '/admin', icon: IconLayoutDashboard, label: 'Overview' },
])
const moderation = linkOptions([
	{
		to: '/admin/submissions',
		icon: IconInbox,
		label: 'Submissions',
		count: 'needsReview',
	},
	{
		to: '/admin/ownership',
		icon: IconUserCheck,
		label: 'Ownership requests',
		count: 'pendingClaims',
	},
	{
		to: '/admin/reports',
		search: { status: 'open' },
		icon: IconFlag,
		label: 'Reports',
		count: 'openReports',
	},
])
const catalog = linkOptions([
	{ to: '/projects', icon: IconPackage, label: 'Projects' },
	{ to: '/admin/categories', icon: IconCategory, label: 'Categories' },
	{ to: '/admin/tags', icon: IconTags, label: 'Tags' },
	{ to: '/admin/collections', icon: IconPackage, label: 'Collections' },
	{ to: '/admin/featured', icon: IconStar, label: 'Featured projects' },
])
const administration = linkOptions([
	{ to: '/admin/users', icon: IconUsers, label: 'Users' },
	{ to: '/admin/activity', icon: IconActivity, label: 'Activity' },
	{ to: '/admin/operations', icon: IconServer, label: 'Operations' },
])
const personal = linkOptions([
	{ to: '/managed', icon: IconPackage, label: 'My projects' },
	{ to: '/submission', icon: IconInbox, label: 'Submission' },
	{ to: '/bookmarks', icon: IconBookmark, label: 'Bookmarks' },
])
type NavLink =
	| (typeof overview)[number]
	| (typeof moderation)[number]
	| (typeof catalog)[number]
	| (typeof administration)[number]
	| (typeof personal)[number]

function NavigationGroup({
	label,
	children,
	collapsible = true,
}: {
	label: string
	children: ReactNode
	collapsible?: boolean
}) {
	const { state } = useSidebar()
	const [expanded, setExpanded] = useState(true)
	return (
		<Collapsible
			open={state === 'collapsed' || expanded}
			onOpenChange={setExpanded}
		>
			<SidebarGroup>
				{collapsible ? (
					<SidebarGroupLabel
						render={<CollapsibleTrigger />}
						className="group/section w-full"
					>
						{label}
						<IconChevronDown className="ml-auto transition-transform group-aria-expanded/section:rotate-180" />
					</SidebarGroupLabel>
				) : (
					<SidebarGroupLabel>{label}</SidebarGroupLabel>
				)}
				<CollapsibleContent>
					<SidebarGroupContent>
						<SidebarMenu>{children}</SidebarMenu>
					</SidebarGroupContent>
				</CollapsibleContent>
			</SidebarGroup>
		</Collapsible>
	)
}

function NavigationLink({
	item,
	count,
}: {
	item: NavLink & { count?: string }
	count?: number | null
}) {
	const matchRoute = useMatchRoute()
	const { isMobile, setOpenMobile } = useSidebar()
	const { label, icon: Icon, count: _countKey, ...link } = item
	void _countKey
	const close = () => {
		if (isMobile) setOpenMobile(false)
	}
	const isActive = !!matchRoute({ to: link.to, fuzzy: link.to !== '/admin' })
	return (
		<SidebarMenuItem>
			<SidebarMenuButton
				tooltip={label}
				isActive={isActive}
				render={
					<Link
						{...link}
						onClick={close}
						activeOptions={{
							exact: link.to === '/admin',
							includeSearch: false,
						}}
						aria-current={isActive ? 'page' : undefined}
					>
						<Icon />
						<span>{label}</span>
					</Link>
				}
			/>
			{count !== undefined && (
				<SidebarMenuBadge
					aria-label={
						count === null ? 'Count unavailable' : `${count} awaiting review`
					}
				>
					{count === null ? '—' : count > 99 ? '99+' : count}
				</SidebarMenuBadge>
			)}
			{item.to === '/projects' && (
				<>
					<SidebarMenuAction
						render={<Link to="/projects/create" onClick={close} />}
						aria-label="Create project"
						title="Create project"
					>
						<IconPlus />
					</SidebarMenuAction>
					<SidebarMenuSub>
						<SidebarMenuSubItem>
							<SidebarMenuSubButton
								render={
									<Link
										to="/projects"
										search={{ status: 'published' }}
										onClick={close}
									/>
								}
							>
								Published
							</SidebarMenuSubButton>
						</SidebarMenuSubItem>
						<SidebarMenuSubItem>
							<SidebarMenuSubButton
								render={
									<Link
										to="/projects"
										search={{ status: 'draft' }}
										onClick={close}
									/>
								}
							>
								Drafts
							</SidebarMenuSubButton>
						</SidebarMenuSubItem>
					</SidebarMenuSub>
				</>
			)}
		</SidebarMenuItem>
	)
}

function AdminNavigation() {
	const { auth } = useRouteContext({ from: '/_main' })
	return (
		<QueryBoundary
			resetKey={auth.user.id}
			pending={<AdminNavigationLinks />}
			error={(_, retry) => <AdminNavigationLinks onRetryCounts={retry} />}
		>
			<AdminNavigationCounts userId={auth.user.id} />
		</QueryBoundary>
	)
}

function AdminNavigationCounts({ userId }: { userId: string }) {
	const query = useSuspenseQuery(dashboardQueries.overview(userId))
	return <AdminNavigationLinks counts={query.data.counts} />
}

function AdminNavigationLinks({
	counts,
	onRetryCounts,
}: {
	counts?: Record<string, number>
	onRetryCounts?: () => void
}) {
	return (
		<>
			<NavigationGroup label="Workspace" collapsible={false}>
				{overview.map((item) => (
					<NavigationLink key={item.to} item={item} />
				))}
			</NavigationGroup>
			<NavigationGroup label="Moderation">
				{moderation.map((item) => (
					<NavigationLink
						key={item.to}
						item={item}
						count={counts?.[item.count] ?? null}
					/>
				))}
				{onRetryCounts && (
					<SidebarMenuItem>
						<SidebarMenuButton
							type="button"
							onClick={onRetryCounts}
							tooltip="Retry counts"
						>
							<IconRefresh aria-hidden="true" />
							<span>Retry counts</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				)}
			</NavigationGroup>
			<NavigationGroup label="Catalog">
				{catalog.map((item) => (
					<NavigationLink key={item.to} item={item} />
				))}
			</NavigationGroup>
			<NavigationGroup label="Administration">
				{administration.map((item) => (
					<NavigationLink key={item.to} item={item} />
				))}
			</NavigationGroup>
			<SidebarSeparator />
		</>
	)
}

export function MainSidebarContent() {
	const { auth } = useRouteContext({ from: '/_main' })
	return (
		<SidebarContent className="group-data-[collapsible=icon]:overflow-y-auto">
			{auth.user.role === 'admin' && <AdminNavigation />}
			<NavigationGroup label="Personal" collapsible={false}>
				{personal
					.filter(
						(item) => auth.user.role !== 'admin' || item.to !== '/submission'
					)
					.map((item) => (
						<NavigationLink key={item.to} item={item} />
					))}
			</NavigationGroup>
		</SidebarContent>
	)
}
