import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_panel/my-submissions')({
	component: RouteComponent,
})

function RouteComponent() {
	return <div>Hello "/_panel/my-submissions"!</div>
}
