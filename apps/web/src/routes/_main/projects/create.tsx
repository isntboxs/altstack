import { createFileRoute } from '@tanstack/react-router'

import { CreateProjectForm } from '#/features/admin-projects/components/create-project-form'

export const Route = createFileRoute('/_main/projects/create')({
	component: CreateProjectForm,
})
