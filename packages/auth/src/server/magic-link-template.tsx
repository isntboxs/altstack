import {
	Body,
	Button,
	Container,
	Head,
	Heading,
	Html,
	Link,
	Preview,
	Text,
	Tailwind,
	pixelBasedPreset,
} from 'react-email'

interface MagicLinkEmailProps {
	url: string
}

export function MagicLinkEmail({ url }: MagicLinkEmailProps) {
	return (
		<Html lang="en">
			<Tailwind config={{ presets: [pixelBasedPreset] }}>
				<Head />
				<Body className="m-0 bg-white font-sans text-neutral-900">
					<Preview>Your AltStack sign-in link. Expires in 10 minutes.</Preview>
					<Container className="mx-auto max-w-md px-6 py-10">
						<Text className="text-sm font-semibold">AltStack</Text>
						<Heading as="h1" className="text-2xl font-semibold">
							Sign in to AltStack
						</Heading>
						<Text className="text-base leading-6 text-neutral-600">
							Join the open source community. Use this link to securely sign in
							to your account.
						</Text>
						<Button
							href={url}
							className="box-border rounded-lg bg-neutral-900 px-6 py-3 text-center text-sm font-medium text-white no-underline"
						>
							Sign in to AltStack
						</Button>
						<Text className="text-sm leading-6 text-neutral-600">
							This link expires in 10 minutes and can only be used once. Do not
							forward or share it.
						</Text>
						<Text className="text-sm leading-6 text-neutral-600">
							If the button does not work,{' '}
							<Link href={url}>open your sign-in link</Link>.
						</Text>
						<Text className="text-sm leading-6 text-neutral-600">
							If you did not request this email, you can safely ignore it.
						</Text>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	)
}

MagicLinkEmail.PreviewProps = {
	url: 'https://example.com/sign-in-preview',
} satisfies MagicLinkEmailProps
