import { TableHead, TableHeader, TableRow } from '@altstack/ui/components/table'

export function TableColumnHeadings({ headings }: { headings: Array<string> }) {
	return (
		<TableHeader>
			<TableRow>
				{headings.map((heading) => (
					<TableHead key={heading}>{heading}</TableHead>
				))}
			</TableRow>
		</TableHeader>
	)
}
