import type { ComponentProps, FC } from 'react'

import { SidebarContent } from '@altstack/ui/components/sidebar'

type PanelSidebarContentProps = ComponentProps<typeof SidebarContent>

export const PanelSidebarContent: FC<PanelSidebarContentProps> = ({
	...props
}) => <SidebarContent {...props}></SidebarContent>
