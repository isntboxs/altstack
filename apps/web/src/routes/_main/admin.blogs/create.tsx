import { createFileRoute } from '@tanstack/react-router'

import { BlogEditor } from '#/features/admin-blogs/editor'
export const Route = createFileRoute('/_main/admin/blogs/create')({
	component: () => <BlogEditor />,
})
