import { IconSearch } from '@tabler/icons-react'

import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from '@altstack/ui/components/input-group'
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from '@altstack/ui/components/select'

const selectItems = [
	{ label: 'Latest', value: 'latest' },
	{ label: 'Oldest', value: 'oldest' },
	{ label: 'Name (A-Z)', value: 'name-asc' },
	{ label: 'Name (Z-A)', value: 'name-desc' },
	{ label: 'Most Popular', value: 'most-popular' },
	{ label: 'Most Stars', value: 'most-stars' },
	{ label: 'Most Forks', value: 'most-forks' },
	{ label: 'Last Commit', value: 'last-commit' },
	{ label: 'Repository Age', value: 'repository-age' },
]

export const FilterSection = () => (
	<section className="container mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-6 md:flex-row lg:px-16">
		<InputGroup>
			<InputGroupAddon>
				<IconSearch />
			</InputGroupAddon>

			<InputGroupInput placeholder="Search..." />
		</InputGroup>

		<Select items={selectItems}>
			<SelectTrigger className="w-full max-w-48">
				<SelectValue placeholder="Order By" />
			</SelectTrigger>

			<SelectContent>
				<SelectGroup>
					<SelectLabel>Order By</SelectLabel>
					{selectItems.map((item) => (
						<SelectItem key={item.value} value={item.value}>
							{item.label}
						</SelectItem>
					))}
				</SelectGroup>
			</SelectContent>
		</Select>
	</section>
)
