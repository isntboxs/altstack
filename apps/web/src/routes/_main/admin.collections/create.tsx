import { createFileRoute } from '@tanstack/react-router'

import { CollectionEditor } from '#/features/admin-collections/editor'
export const Route = createFileRoute('/_main/admin/collections/create')({
	component: () => <CollectionEditor />,
})
