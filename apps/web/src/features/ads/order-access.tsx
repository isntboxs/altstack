import { useState } from 'react'

import { Button } from '@altstack/ui/components/button'
import { Field, FieldGroup, FieldLabel } from '@altstack/ui/components/field'
import { Input } from '@altstack/ui/components/input'

import { client } from '#/utils/orpc'

export function AdAccessRequest() {
	const [email, setEmail] = useState(''),
		[busy, setBusy] = useState(false),
		[message, setMessage] = useState(''),
		[error, setError] = useState('')
	return (
		<section className="flex flex-col gap-4" aria-labelledby="ad-access-title">
			<h2 id="ad-access-title" className="text-xl font-semibold">
				Already have an order?
			</h2>
			<p className="text-sm text-muted-foreground">
				Request a fresh private link. No account or password needed.
			</p>
			<form
				onSubmit={async (event) => {
					event.preventDefault()
					setBusy(true)
					setError('')
					setMessage('')
					try {
						await client.adBilling.requestAccess({ body: { email } })
						setMessage(
							'If this email has advertising orders, a private link will arrive shortly. Check your spam folder too.'
						)
					} catch {
						setError(
							'Unable to request a link. Please wait a few minutes and try again.'
						)
					} finally {
						setBusy(false)
					}
				}}
			>
				<FieldGroup>
					<Field>
						<FieldLabel htmlFor="ad-access-email">Order email</FieldLabel>
						<Input
							id="ad-access-email"
							autoComplete="email"
							type="email"
							maxLength={254}
							required
							value={email}
							onChange={(event) => setEmail(event.target.value)}
						/>
					</Field>
					<Button disabled={busy} type="submit">
						{busy ? 'Requesting…' : 'Email management link'}
					</Button>
				</FieldGroup>
			</form>
			{message && <output className="text-sm">{message}</output>}
			{error && (
				<p role="alert" className="text-sm text-destructive">
					{error}
				</p>
			)}
		</section>
	)
}
