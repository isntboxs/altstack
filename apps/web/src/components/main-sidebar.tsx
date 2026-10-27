import type { ComponentProps, FC } from 'react'

import {
	Sidebar,
	SidebarRail,
	SidebarSeparator,
} from '@altstack/ui/components/sidebar'

import { MainSidebarContent } from '#/components/main-sidebar-content'
import { MainSidebarFooter } from '#/components/main-sidebar-footer'
import { MainSidebarHeader } from '#/components/main-sidebar-header'

type MainSidebarProps = ComponentProps<typeof Sidebar>

export const MainSidebar: FC<MainSidebarProps> = ({ ...props }) => (
	<Sidebar collapsible="icon" {...props}>
		<MainSidebarHeader />

		<MainSidebarContent />

		<SidebarSeparator />
		<MainSidebarFooter />
		<SidebarRail />
	</Sidebar>
)
