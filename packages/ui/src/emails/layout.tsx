import type { ReactNode } from 'react'
import {
	Body,
	Column,
	Container,
	Head,
	Heading,
	Hr,
	Html,
	Img,
	Preview,
	Row,
	Section,
	Tailwind,
	Text,
	pixelBasedPreset,
} from 'react-email'

import { emailUrl } from '@altstack/ui/emails/primitives'

export interface EmailBrandProps {
	appUrl: string
}

export function EmailLayout({
	appUrl,
	preview,
	eyebrow,
	title,
	children,
}: EmailBrandProps & {
	preview: string
	eyebrow: string
	title: string
	children: ReactNode
}) {
	const origin = new URL(emailUrl(appUrl)).origin
	return (
		<Html lang="en">
			<Tailwind config={{ presets: [pixelBasedPreset] }}>
				<Head />
				<Body
					className="m-0 bg-[#f5f5f5] text-[#171717]"
					style={{ fontFamily: 'Inter, Arial, Helvetica, sans-serif' }}
				>
					<Preview>{preview}</Preview>
					<Container
						className="mx-auto w-full max-w-[560px] px-4 py-8"
						style={{ tableLayout: 'fixed' }}
					>
						<Section className="rounded-xl border border-solid border-[#e5e5e5] bg-white px-6 py-8">
							<Row>
								<Column width="40">
									<Img
										src={`${origin}/brand/altstack-email-symbol.png`}
										alt=""
										width="32"
										height="32"
									/>
								</Column>
								<Column>
									<Text className="m-0 text-xl leading-8 font-medium text-black">
										altstack
									</Text>
								</Column>
							</Row>
							<Hr className="my-7 border-0 border-t border-solid border-[#e5e5e5]" />
							<Text className="mb-3 text-xs font-semibold tracking-[2px] text-[#525252]">
								{eyebrow}
							</Text>
							<Heading
								as="h1"
								className="m-0 text-[28px] leading-9 font-semibold tracking-[-0.7px]"
								style={{ overflowWrap: 'anywhere' }}
							>
								{title}
							</Heading>
							{children}
						</Section>
						<Text className="mx-2 my-5 text-center text-xs leading-5 text-[#525252]">
							altstack · Discover open source alternatives.
						</Text>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	)
}
