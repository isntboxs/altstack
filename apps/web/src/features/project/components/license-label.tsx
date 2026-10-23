import { Link } from '@tanstack/react-router'

export function LicenseLabel({
	github,
}: {
	github: {
		licenseSlug?: string | null
		licenseSpdxId?: string | null
		licenseName?: string | null
	}
}) {
	if (!github.licenseSlug || !github.licenseSpdxId) return <span>unknown</span>
	return (
		<Link
			to="/licenses/$slug"
			params={{ slug: github.licenseSlug }}
			title={github.licenseName ?? github.licenseSpdxId}
			className="relative z-20 underline decoration-border underline-offset-4 hover:decoration-foreground"
		>
			{github.licenseSpdxId}
		</Link>
	)
}
