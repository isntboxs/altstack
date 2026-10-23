import type { ReactNode } from 'react'
import { Button, Link, Text } from 'react-email'

// Templates accept absolute URLs from their server caller, never user HTML.
export function emailUrl(value: string) {
	const url = new URL(value)
	if (
		!['https:', 'http:'].includes(url.protocol) ||
		url.username ||
		url.password ||
		/[\r\n]/.test(value)
	) {
		throw new Error('Email links must use absolute HTTP(S) URLs')
	}
	return url.href
}

export function EmailText({ children }: { children: ReactNode }) {
	return (
		<Text
			className="my-5 text-base leading-7 text-[#525252]"
			style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
		>
			{children}
		</Text>
	)
}

export function EmailAction({
	href,
	children,
}: {
	href: string
	children: ReactNode
}) {
	return (
		<Button
			href={emailUrl(href)}
			className="box-border rounded-lg bg-black px-6 py-4 text-center text-sm font-semibold text-white no-underline"
		>
			{children}
		</Button>
	)
}

export function EmailLink({
	href,
	children,
}: {
	href: string
	children: ReactNode
}) {
	return (
		<Link
			href={emailUrl(href)}
			className="text-black underline"
			style={{ overflowWrap: 'anywhere' }}
		>
			{children}
		</Link>
	)
}
