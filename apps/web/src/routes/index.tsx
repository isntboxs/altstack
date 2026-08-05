import { createFileRoute } from '@tanstack/react-router'

import { FilterSection } from '#/components/filter-section'
import { HeroSection } from '#/components/hero-section'

export const Route = createFileRoute('/')({
	component: Home,
})

function Home() {
	return (
		<>
			<HeroSection />
			<FilterSection />
		</>
	)
}
