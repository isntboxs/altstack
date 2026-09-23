import type { ComponentProps, FC } from 'react'

import { Sidebar } from '@altstack/ui/components/sidebar'

import { MainSidebarContent } from '#/components/main-sidebar-content'
import { MainSidebarFooter } from '#/components/main-sidebar-footer'
import { MainSidebarHeader } from '#/components/main-sidebar-header'

type MainSidebarProps = ComponentProps<typeof Sidebar>

export const MainSidebar: FC<MainSidebarProps> = ({ ...props }) => (
	<Sidebar {...props}>
		<MainSidebarHeader />

		<MainSidebarContent />

		<MainSidebarFooter />
	</Sidebar>
)
