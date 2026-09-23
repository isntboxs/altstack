import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_main/projects')({
	component: Outlet,
})
