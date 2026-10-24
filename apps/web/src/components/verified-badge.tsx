import { IconRosetteDiscountCheckFilled } from '@tabler/icons-react'

export function VerifiedBadge() {
	return (
		<span
			className="inline-flex shrink-0 align-middle text-verified"
			title="Verified project representative"
		>
			<IconRosetteDiscountCheckFilled aria-hidden="true" className="size-4" />
			<span className="sr-only">Verified project</span>
		</span>
	)
}
