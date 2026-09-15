import type { ComponentProps, FC } from 'react'

import { Sidebar } from '@altstack/ui/components/sidebar'

import { PanelSidebarContent } from '#/components/panel-sidebar-content'
import { PanelSidebarFooter } from '#/components/panel-sidebar-footer'
import { PanelSidebarHeader } from '#/components/panel-sidebar-header'

type PanelSidebarProps = ComponentProps<typeof Sidebar>

export const PanelSidebar: FC<PanelSidebarProps> = ({ ...props }) => (
	<Sidebar {...props}>
		<PanelSidebarHeader />

		<PanelSidebarContent />

		<PanelSidebarFooter />
	</Sidebar>
)
