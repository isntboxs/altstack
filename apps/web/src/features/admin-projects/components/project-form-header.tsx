import { IconArrowLeft } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'

export function ProjectFormHeader({
	title,
	description,
}: {
	title: string
	description: string
}) {
	return (
		<div className="space-y-3">
			<Link
				to="/projects"
				className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
			>
				<IconArrowLeft className="size-4" />
				Projects
			</Link>
			<div className="space-y-1">
				<h1 className="text-xl font-semibold tracking-tight">{title}</h1>
				<p className="text-sm text-muted-foreground">{description}</p>
			</div>
		</div>
	)
}
